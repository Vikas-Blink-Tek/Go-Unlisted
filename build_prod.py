import os
import subprocess
import shutil
import zipfile

def main():
    workspace = '/Users/ashwatisuvarna/Go-Unlisted'
    client_dir = os.path.join(workspace, 'client')
    dist_dir = os.path.join(client_dir, 'dist')
    api_dir = os.path.join(workspace, 'api')
    zip_path = os.path.join(workspace, 'gounlisted_production.zip')
    temp_dir = os.path.join(workspace, 'prod_temp')

    print("Building React client...")
    npm_path = shutil.which('npm')
    if not npm_path:
        npm_path = '/opt/homebrew/bin/npm' if os.path.exists('/opt/homebrew/bin/npm') else '/usr/local/bin/npm'
    
    try:
        subprocess.run([npm_path, 'run', 'build'], cwd=client_dir, check=True)
    except Exception as e:
        print(f"Error during build: {e}")
        return

    print("Copying files...")
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir)

    if os.path.exists(dist_dir):
        for item in os.listdir(dist_dir):
            s = os.path.join(dist_dir, item)
            d = os.path.join(temp_dir, item)
            if os.path.isdir(s):
                shutil.copytree(s, d)
            else:
                shutil.copy2(s, d)
    
    # Exclude local config files from the API deployment
    dest_api = os.path.join(temp_dir, 'api')
    if os.path.exists(api_dir):
        shutil.copytree(
            api_dir, 
            dest_api, 
            ignore=shutil.ignore_patterns('*.local.php', '*.log')
        )
        
    print(f"Creating zip file at {zip_path}...")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, temp_dir)
                zipf.write(file_path, arcname)
                
    shutil.rmtree(temp_dir)
    print("Done! Zip file is ready.")

if __name__ == '__main__':
    main()
