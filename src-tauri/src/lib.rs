use tauri::image::Image;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

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
                            // Emit toggle-timer event to the frontend
                            let _ = window.emit("toggle-timer", ());
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                // Set the window icon from the bundled PNG (embedded at compile time)
                if let Ok(img) = Image::from_bytes(include_bytes!("../icons/icon.png")) {
                    let _ = window.set_icon(img);
                }

                // Set initial titlebar theme to light (matches app default)
                let _ = window.set_theme(Some(tauri::Theme::Light));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
