use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::Duration;
use tauri::image::Image;
use tauri::{Manager};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};
use url::Url;

/// Starts a temporary local HTTP server, opens the Google OAuth consent screen,
/// and returns the authorization code from the callback.
#[tauri::command]
async fn start_oauth_flow(client_id: String) -> Result<String, String> {
    // Bind to a random free port
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{}", port);

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?\
         client_id={}&\
         redirect_uri={}&\
         response_type=code&\
         scope=https://www.googleapis.com/auth/youtube.readonly%20openid%20profile%20email&\
         access_type=offline&\
         prompt=consent",
        urlencoding(&client_id),
        urlencoding(&redirect_uri),
    );

    // Open the browser
    open::that(&auth_url).map_err(|e| format!("Failed to open browser: {}", e))?;

    // Wait for the callback with a 2-minute timeout so the app doesn't hang
    // if the user closes the browser window without completing the flow.
    listener
        .set_nonblocking(false)
        .map_err(|e| e.to_string())?;
    let timeout = Duration::from_secs(120);
    listener
        .set_nonblocking(false)
        .map_err(|e| e.to_string())?;

    // Use a thread with timeout to accept the connection
    let accept_result = std::thread::spawn(move || {
        listener
            .set_nonblocking(false)
            .ok();
        // Set a socket-level timeout by polling with non-blocking + sleep
        listener.set_nonblocking(true).ok();
        let start = std::time::Instant::now();
        loop {
            match listener.accept() {
                Ok(conn) => return Ok(conn),
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    if start.elapsed() > timeout {
                        return Err("Anmeldung abgelaufen — Browser-Fenster wurde geschlossen oder Zeitlimit überschritten.".to_string());
                    }
                    std::thread::sleep(Duration::from_millis(200));
                }
                Err(e) => return Err(e.to_string()),
            }
        }
    })
    .join()
    .map_err(|_| "Thread error".to_string())?;

    let (mut stream, _addr) = accept_result?;

    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buf[..n]);

    // Extract the path from "GET /path HTTP/1.1"
    let path = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .ok_or("Invalid HTTP request")?;

    let full_url = format!("http://127.0.0.1:{}{}", port, path);
    let parsed = Url::parse(&full_url).map_err(|e| e.to_string())?;

    // Check for error
    if let Some(error) = parsed.query_pairs().find(|(k, _)| k == "error") {
        let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h2>Anmeldung fehlgeschlagen</h2><p>Du kannst dieses Fenster schließen.</p></body></html>";
        let _ = stream.write_all(response.as_bytes());
        return Err(format!("OAuth error: {}", error.1));
    }

    // Extract auth code
    let code = parsed
        .query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.to_string())
        .ok_or("No authorization code in callback")?;

    // Respond with success page
    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h2>Anmeldung erfolgreich!</h2><p>Du kannst dieses Fenster schließen und zur App zurückkehren.</p><script>window.close()</script></body></html>";
    let _ = stream.write_all(response.as_bytes());

    // Return code and redirect_uri as JSON so frontend can exchange it
    Ok(serde_json::json!({
        "code": code,
        "redirect_uri": redirect_uri
    })
    .to_string())
}

fn urlencoding(s: &str) -> String {
    url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Digit2);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts([shortcut])
                .unwrap()
                .with_handler(move |app, _sc, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            // Toggle window visibility: if visible & focused → hide,
                            // otherwise bring to front and focus
                            let visible = window.is_visible().unwrap_or(true);
                            let opend = !(window.is_minimized().unwrap_or(true));

                            if visible && opend{
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![start_oauth_flow])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(img) = Image::from_bytes(include_bytes!("../icons/icon.png")) {
                    let _ = window.set_icon(img);
                }
                let _ = window.set_theme(Some(tauri::Theme::Light));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
