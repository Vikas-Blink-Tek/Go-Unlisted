import 'dart:convert';
import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import 'api_config.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.status});
  final String message;
  final int? status;

  @override
  String toString() => message;
}

/// Session-aware API client — same PHP backend / live DB as the website.
class GuApi {
  GuApi._();
  static final GuApi instance = GuApi._();

  Dio? _dio;
  String? _csrf;
  CookieJar? _jar;
  Future<void>? _initFuture;

  Future<void> init() {
    return _initFuture ??= _doInit();
  }

  Future<void> _doInit() async {
    if (_dio != null) return;

    if (kIsWeb) {
      _jar = CookieJar();
    } else {
      final dir = await getApplicationSupportDirectory();
      final cookiePath = '${dir.path}/gu_cookies';
      await Directory(cookiePath).create(recursive: true);
      _jar = PersistCookieJar(
        ignoreExpires: true,
        storage: FileStorage(cookiePath),
      );
    }

    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 45),
        sendTimeout: const Duration(seconds: 45),
        followRedirects: true,
        maxRedirects: 5,
        headers: {
          'Accept': 'application/json',
          'User-Agent': '${ApiConfig.clientName}/${ApiConfig.clientVersion} (Flutter; Dio)',
          'X-GU-Client': ApiConfig.clientName,
          'X-GU-Client-Version': ApiConfig.clientVersion,
        },
        validateStatus: (s) => s != null && s < 500,
      ),
    )..interceptors.add(CookieManager(_jar!));
  }

  Dio get dio {
    final d = _dio;
    if (d == null) {
      throw StateError('GuApi.init() must be called before requests');
    }
    return d;
  }

  /// Call after login / register / logout — server rotates CSRF with the session.
  void invalidateCsrf() {
    _csrf = null;
  }

  Future<String> ensureCsrf({bool force = false}) async {
    if (!force && _csrf != null && _csrf!.isNotEmpty) return _csrf!;
    final res = await get('getCsrfToken');
    _csrf = (res['csrfToken'] ?? res['token'] ?? '').toString();
    if (_csrf == null || _csrf!.isEmpty) {
      throw ApiException('Could not start a secure session. Check your internet connection.');
    }
    return _csrf!;
  }

  Future<Map<String, dynamic>> get(
    String action, {
    Map<String, String>? params,
  }) async {
    await init();
    try {
      final query = {'action': action, ...?params};
      final response = await dio.get(
        '/api/api.php',
        queryParameters: query,
      );
      return _parse(response);
    } on DioException catch (e) {
      throw _mapDio(e);
    }
  }

  Future<Map<String, dynamic>> post(
    String action,
    Map<String, dynamic> body, {
    Map<String, String>? params,
  }) async {
    await init();
    try {
      var token = await ensureCsrf();
      var response = await _postOnce(action, body, params, token);

      // Session rotated (e.g. after login elsewhere) — refresh CSRF once and retry.
      if (response.statusCode == 403) {
        final msg = _errorMessage(response.data);
        if (msg.toLowerCase().contains('csrf')) {
          token = await ensureCsrf(force: true);
          response = await _postOnce(action, body, params, token);
        }
      }

      final parsed = _parse(response);
      if (parsed['csrfToken'] != null) {
        _csrf = parsed['csrfToken'].toString();
      }
      return parsed;
    } on DioException catch (e) {
      throw _mapDio(e);
    }
  }

  Future<Response> _postOnce(
    String action,
    Map<String, dynamic> body,
    Map<String, String>? params,
    String token,
  ) {
    return dio.post(
      '/api/api.php',
      queryParameters: {'action': action, ...?params},
      data: jsonEncode(body),
      options: Options(
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
      ),
    );
  }

  Future<Map<String, dynamic>> uploadProofBytes(
    List<int> bytes, {
    required String filename,
  }) async {
    await init();
    try {
      final token = await ensureCsrf();
      final form = FormData.fromMap({
        'proof': MultipartFile.fromBytes(bytes, filename: filename),
      });
      final response = await dio.post(
        '/api/api.php',
        queryParameters: {'action': 'uploadKycDematProof'},
        data: form,
        options: Options(headers: {'X-CSRF-Token': token}),
      );
      return _parse(response);
    } on DioException catch (e) {
      throw _mapDio(e);
    }
  }

  /// Authenticated CMR / demat proof bytes (images or PDF).
  Future<({Uint8List bytes, String contentType})> fetchKycProof({
    String? userId,
    String? filePath,
  }) async {
    await init();
    try {
      final query = <String, String>{'action': 'viewKycProof'};
      if (userId != null && userId.isNotEmpty) query['userId'] = userId;
      if (filePath != null && filePath.isNotEmpty) query['file'] = filePath;
      final response = await dio.get<List<int>>(
        '/api/api.php',
        queryParameters: query,
        options: Options(
          responseType: ResponseType.bytes,
          headers: {'Accept': '*/*'},
        ),
      );
      final status = response.statusCode ?? 0;
      final raw = response.data ?? <int>[];
      final bytes = Uint8List.fromList(raw);
      if (status >= 400) {
        try {
          final err = jsonDecode(utf8.decode(bytes));
          throw ApiException((err is Map ? err['error'] : null)?.toString() ?? 'Could not load document', status: status);
        } catch (e) {
          if (e is ApiException) rethrow;
          throw ApiException('Could not load document', status: status);
        }
      }
      final ctype = (response.headers.value('content-type') ?? 'application/octet-stream').split(';').first.trim();
      return (bytes: bytes, contentType: ctype);
    } on DioException catch (e) {
      throw _mapDio(e);
    }
  }

  String _errorMessage(dynamic data) {
    if (data is Map) return (data['error'] ?? data['message'] ?? '').toString();
    if (data is String) return data;
    return '';
  }

  Map<String, dynamic> _parse(Response response) {
    final data = response.data;
    Map<String, dynamic> json;
    if (data is Map<String, dynamic>) {
      json = data;
    } else if (data is Map) {
      json = Map<String, dynamic>.from(data);
    } else if (data is String) {
      try {
        final decoded = jsonDecode(data);
        if (decoded is List) return {'data': decoded};
        json = Map<String, dynamic>.from(decoded as Map);
      } catch (_) {
        throw ApiException('Something went wrong. Please try again.', status: response.statusCode);
      }
    } else if (data is List) {
      return {'data': data};
    } else {
      json = {};
    }

    final status = response.statusCode ?? 0;
    if (status >= 400 || json['error'] != null) {
      throw ApiException(
        (json['error'] ?? json['message'] ?? 'Request failed ($status)').toString(),
        status: status,
      );
    }
    return json;
  }

  ApiException _mapDio(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return ApiException('Connection timed out. Check your internet and try again.');
    }
    if (e.type == DioExceptionType.connectionError) {
      return ApiException('No internet connection to GO UNLISTED servers.');
    }
    final status = e.response?.statusCode;
    final msg = _errorMessage(e.response?.data);
    if (msg.isNotEmpty) return ApiException(msg, status: status);
    return ApiException('Network error. Please try again.', status: status);
  }

  Future<void> clearSession() async {
    _csrf = null;
    await _jar?.deleteAll();
  }
}
