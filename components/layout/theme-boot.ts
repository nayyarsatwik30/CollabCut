export const THEME_KEY = 'collabcut-app-theme'

// Runs synchronously inside the app root before its children paint. A stored
// choice wins; prefers-color-scheme only seeds a first visit.
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.currentScript.parentElement.setAttribute('data-theme',t)}catch(e){}})()`
