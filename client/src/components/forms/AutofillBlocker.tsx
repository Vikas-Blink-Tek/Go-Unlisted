/** Hidden fields that absorb browser credential autofill before real inputs. */
export default function AutofillBlocker() {
  return (
    <>
      <input
        type="text"
        name="gu_autofill_trap_user"
        autoComplete="username"
        tabIndex={-1}
        aria-hidden
        className="gu-autofill-trap"
        defaultValue=""
      />
      <input
        type="password"
        name="gu_autofill_trap_pass"
        autoComplete="current-password"
        tabIndex={-1}
        aria-hidden
        className="gu-autofill-trap"
        defaultValue=""
      />
    </>
  );
}
