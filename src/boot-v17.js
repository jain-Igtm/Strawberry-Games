import "./main.js?v=17";

const BUILD_LABEL = "v17 cache refresh";

function relabel() {
  const title = document.getElementById("title");
  const hint = document.getElementById("hint");
  const startBtn = document.getElementById("startBtn");

  if (title) title.textContent = "STRAWBERRY FOREST — " + BUILD_LABEL;
  if (startBtn) startBtn.textContent = "Start — " + BUILD_LABEL;

  if (hint && !hint.textContent.startsWith("Runtime error:")) {
    hint.textContent = "Build v17 loaded. Cache refresh confirmed. Same forest build, new loader.";
  }
}

relabel();
setTimeout(relabel, 250);
setTimeout(relabel, 1000);
setTimeout(relabel, 2500);
