//! Real webviews for the browser panes.
//!
//! The pane used to be an `<iframe>`, which cannot work for anything with a
//! login. The app's document is `tauri.localhost` and the forward answers on
//! `127.0.0.1`, so a framed page is a *cross-site* context: its `SameSite=Lax`
//! session cookie — the default a cookie gets when it says nothing — is never
//! sent back, and every service that authenticates bounces straight back to
//! its login screen. `X-Frame-Options` was only the first symptom.
//!
//! A child webview is a top-level document instead. Cookies, storage and
//! framing headers all behave exactly as they would in a browser tab, because
//! that is what it is.
//!
//! The catch is that a child webview is a native surface: it is positioned by
//! this module rather than by CSS, and it paints over the React layer instead
//! of taking part in its stacking order. The pane therefore reports its box on
//! every frame that moves it, and stands down whenever the app means to draw
//! something on top.
//!
//! These webviews load a remote origin, so Tauri does not inject its IPC into
//! them — the forwarded page cannot reach any command in this app.

use tauri::webview::WebviewBuilder;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, Webview, WebviewUrl};

/// The pane's box inside the window, in the CSS pixels the React layer measures.
#[derive(Clone, Copy, serde::Deserialize)]
pub struct PaneRect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

/// Payload of both `browser://navigated` (the pane moved to a new page) and
/// `browser://external` (it tried to leave the forwarded service and was sent
/// to the real browser instead).
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Navigated {
    label: String,
    url: String,
}

const MAIN_WINDOW: &str = "main";

/// A missing view is not worth an error: panes close while frames are still in
/// flight, so the late `set_rect` that follows is expected, not a fault.
fn view(app: &AppHandle, label: &str) -> Option<Webview> {
    app.get_webview(label)
}

fn place(view: &Webview, rect: PaneRect) -> Result<(), String> {
    view.set_position(LogicalPosition::new(rect.x, rect.y))
        .map_err(|e| e.to_string())?;
    // Some platforms reject a zero-sized webview outright, and a pane can
    // measure zero for a frame mid-transition.
    view.set_size(LogicalSize::new(rect.width.max(1.0), rect.height.max(1.0)))
        .map_err(|e| e.to_string())
}

/// Open (or re-point) the webview behind one browser pane.
///
/// Must stay `async`: creating a webview from a synchronous command deadlocks
/// WebView2, because the call waits on the same main thread it posts to.
#[tauri::command]
pub async fn browser_view_open(
    app: AppHandle,
    label: String,
    url: String,
    rect: PaneRect,
) -> Result<(), String> {
    let target = Url::parse(&url).map_err(|e| format!("could not read the address: {e}"))?;

    if let Some(existing) = view(&app, &label) {
        existing.navigate(target).map_err(|e| e.to_string())?;
        place(&existing, rect)?;
        return existing.show().map_err(|e| e.to_string());
    }

    let window = app
        .get_window(MAIN_WINDOW)
        .ok_or_else(|| "the main window is gone".to_string())?;

    // The pane belongs to one forwarded service. A link that leads off it —
    // an OAuth hop, a docs site — goes to the real browser rather than
    // stranding the pane on an address its toolbar cannot describe.
    let authority = (
        target.host_str().unwrap_or_default().to_string(),
        target.port_or_known_default(),
    );
    let emitter = app.clone();
    let id = label.clone();

    let builder = WebviewBuilder::new(label.as_str(), WebviewUrl::External(target.clone()))
        .on_navigation(move |url| {
            let elsewhere = matches!(url.scheme(), "http" | "https")
                && (url.host_str().unwrap_or_default() != authority.0
                    || url.port_or_known_default() != authority.1);
            let event = if elsewhere {
                "browser://external"
            } else {
                "browser://navigated"
            };
            let _ = emitter.emit(
                event,
                Navigated {
                    label: id.clone(),
                    url: url.to_string(),
                },
            );
            !elsewhere
        });

    window
        .add_child(
            builder,
            LogicalPosition::new(rect.x, rect.y),
            LogicalSize::new(rect.width.max(1.0), rect.height.max(1.0)),
        )
        .map_err(|e| format!("could not open the browser view: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn browser_view_set_rect(app: AppHandle, label: String, rect: PaneRect) {
    if let Some(view) = view(&app, &label) {
        let _ = place(&view, rect);
    }
}

#[tauri::command]
pub async fn browser_view_show(app: AppHandle, label: String, rect: PaneRect) {
    if let Some(view) = view(&app, &label) {
        let _ = place(&view, rect);
        let _ = view.show();
    }
}

#[tauri::command]
pub async fn browser_view_hide(app: AppHandle, label: String) {
    if let Some(view) = view(&app, &label) {
        let _ = view.hide();
    }
}

#[tauri::command]
pub async fn browser_view_close(app: AppHandle, label: String) {
    if let Some(view) = view(&app, &label) {
        let _ = view.close();
    }
}

/// Run a bit of navigation script in the pane.
///
/// Back, forward and reload are the page's own history rather than anything
/// this app tracks, which is the point of using a webview: they behave the way
/// the same buttons behave in a browser.
fn navigate_script(app: &AppHandle, label: &str, script: &str) {
    if let Some(view) = view(app, label) {
        let _ = view.eval(script);
    }
}

#[tauri::command]
pub async fn browser_view_reload(app: AppHandle, label: String) {
    navigate_script(&app, &label, "location.reload()");
}

#[tauri::command]
pub async fn browser_view_back(app: AppHandle, label: String) {
    navigate_script(&app, &label, "history.back()");
}

#[tauri::command]
pub async fn browser_view_forward(app: AppHandle, label: String) {
    navigate_script(&app, &label, "history.forward()");
}

#[tauri::command]
pub async fn browser_view_navigate(
    app: AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    let target = Url::parse(&url).map_err(|e| format!("could not read the address: {e}"))?;
    match view(&app, &label) {
        Some(view) => view.navigate(target).map_err(|e| e.to_string()),
        None => Ok(()),
    }
}
