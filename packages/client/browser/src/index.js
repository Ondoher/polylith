export function loadCss(cssFiles) {
	cssFiles.forEach(function(uri) {
		if (typeof uri !== 'string') return;

		var link = document.createElement('link');
		link.rel = 'stylesheet';
		link.type = 'text/css';
		link.href = uri;

		document.getElementsByTagName('HEAD')[0].appendChild(link);
	});
}
