const mount = document.querySelector("[data-estimate-form]");
if (mount) {
  let loading;
  function load() {
    if (!loading)
      loading = import("./estimate-form.js").catch(() => {
        loading = undefined;
        mount.innerHTML =
          '<p>We couldn’t load the estimate form. Please refresh or <a href="tel:+18609535622">call 860-953-5622</a>.</p>';
      });
  }
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          load();
          observer.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(mount);
  } else load();
}
