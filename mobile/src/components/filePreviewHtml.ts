// Shared HTML document used by the native WebView and web iframe renderers.

export function buildFilePreviewHtml(base64: string, ext: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: #0f172a; color: #e2e8f0; font-family: -apple-system, Segoe UI, Roboto, sans-serif; }
  #status { font-size: 12px; color: #94a3b8; text-align: center; padding: 24px 12px; }
  #canvasWrap { display: none; padding: 8px; align-items: center; justify-content: center; }
  canvas { max-width: 100%; height: auto; background: #fff; border-radius: 6px; box-shadow: 0 6px 22px rgba(0,0,0,.45); }
  #nav { display: none; align-items: center; justify-content: center; gap: 16px; padding: 4px 0 12px; }
  button { background: #1e293b; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 15px; }
  button:disabled { opacity: .35; }
  #count { font-size: 12px; font-weight: 600; color: #cbd5e1; }
  #doc { display: none; margin: 8px; background: #fff; color: #111; border-radius: 8px; overflow: auto; }
  #doc .docx-wrapper { background: #e2e8f0 !important; padding: 8px !important; }
  #doc .docx { box-shadow: none !important; margin: 0 auto !important; max-width: 100% !important; }
</style>
</head>
<body>
  <div id="status">Loading previewâ€¦</div>
  <div id="canvasWrap"><canvas id="canvas"></canvas></div>
  <div id="nav">
    <button id="prev" disabled>&lsaquo;</button>
    <span id="count">1 / 1</span>
    <button id="next" disabled>&rsaquo;</button>
  </div>
  <div id="doc"></div>
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/pptxviewjs@1.1.9/dist/PptxViewJS.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/docx-preview@0.4.1/dist/docx-preview.js"></script>
  <script>
    (function () {
      var B64 = ${JSON.stringify(base64)};
      var EXT = ${JSON.stringify(ext)};
      var statusEl = document.getElementById('status');
      function reportError(message) {
        statusEl.style.display = 'block';
        statusEl.textContent = message;
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: message })); } catch (e) {}
      }
      function decode(b64) {
        var bin = atob(b64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
      }
      try {
        var bytes = decode(B64);
        if (EXT === 'pptx') {
          var canvas = document.getElementById('canvas');
          var viewer = new PptxViewJS.PPTXViewer({ canvas: canvas, enableThumbnails: false, slideSizeMode: 'fit' });
          var prev = document.getElementById('prev');
          var next = document.getElementById('next');
          var count = document.getElementById('count');
          function paint() {
            var i = viewer.getCurrentSlideIndex();
            var n = viewer.getSlideCount();
            count.textContent = (i + 1) + ' / ' + n;
            prev.disabled = i <= 0;
            next.disabled = i >= n - 1;
          }
          prev.onclick = function () { viewer.previousSlide(canvas).then(paint); };
          next.onclick = function () { viewer.nextSlide(canvas).then(paint); };
          viewer.loadFile(bytes).then(function () {
            return viewer.render();
          }).then(function () {
            statusEl.style.display = 'none';
            document.getElementById('canvasWrap').style.display = 'flex';
            document.getElementById('nav').style.display = 'flex';
            paint();
          }).catch(function () {
            reportError('Could not render this presentation.');
          });
        } else if (EXT === 'docx') {
          var docEl = document.getElementById('doc');
          docx.renderAsync(bytes.buffer, docEl, docEl, {
            inWrapper: true,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
            useBase64URL: true
          }).then(function () {
            statusEl.style.display = 'none';
            docEl.style.display = 'block';
          }).catch(function () {
            reportError('Could not render this document.');
          });
        } else {
          reportError('This file type is not supported in the viewer.');
        }
      } catch (e) {
        reportError('Could not load this file.');
      }
    })();
  </script>
</body>
</html>`;
}



