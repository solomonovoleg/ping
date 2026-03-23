import Foundation
import Capacitor
import AVFoundation

/**
 * Голосовой звонок: громкая связь (динамик) ↔ разговорный динамик (как телефон у уха).
 * WebRTC трогает категорию сессии; overrideOutputAudioPort задаёт конкретный выход.
 */
@objc(CallAudioRoutePlugin)
public class CallAudioRoutePlugin: CAPPlugin {

    @objc func setOutputRoute(_ call: CAPPluginCall) {
        let mode = call.getString("mode") ?? "speaker"

        DispatchQueue.main.async {
            let session = AVAudioSession.sharedInstance()
            do {
                try session.setCategory(
                    .playAndRecord,
                    mode: .voiceChat,
                    options: [.allowBluetooth, .allowBluetoothA2DP]
                )
                if mode == "speaker" {
                    try session.overrideOutputAudioPort(.speaker)
                } else {
                    try session.overrideOutputAudioPort(.none)
                }
                try session.setActive(true)
                call.resolve()
            } catch {
                call.reject("audio_route_failed", error.localizedDescription, error)
            }
        }
    }
}
