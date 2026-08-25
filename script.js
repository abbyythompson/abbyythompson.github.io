// "Email me" puts the address on the clipboard rather than opening a mail
// client, so it has to say out loud that something happened.

const EMAIL = 'abbyythompson@gmail.com';

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(EMAIL);
    return true;
  } catch {
    // The async API needs a secure context and permission. Fall back to the
    // old selection trick for anything that refuses.
    const ta = document.createElement('textarea');
    ta.value = EMAIL;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

document.querySelectorAll('.pill--copy').forEach(btn => {
  let timer;

  btn.addEventListener('click', async () => {
    // Never fail silently — if the clipboard refuses outright, hand them a
    // mail client instead so the click still does something.
    if (!(await copyEmail())) {
      window.location.href = 'mailto:' + EMAIL;
      return;
    }

    btn.classList.add('is-copied');
    // The swap is colour and shape only, so it needs announcing
    btn.setAttribute('aria-label', 'Email address copied');

    clearTimeout(timer);
    timer = setTimeout(() => {
      btn.classList.remove('is-copied');
      btn.removeAttribute('aria-label');
    }, 1800);
  });
});
