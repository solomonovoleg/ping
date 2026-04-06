import Capacitor

@objc(PingCallKitVoipPlugin)
public class PingCallKitVoipPlugin: CAPPlugin {

    public override func load() {
        PingCallKitVoipManager.shared.attach(plugin: self)
        PingCallKitVoipManager.shared.startVoipPushRegistry()
    }

    @objc public func getPendingCallKitActions(_ call: CAPPluginCall) {
        let pending = PingCallKitVoipManager.shared.copyAndClearPendingActions()
        call.resolve(["actions": pending])
    }

    @objc public func reportCallEnded(_ call: CAPPluginCall) {
        let callId = call.getString("callId") ?? ""
        if !callId.isEmpty {
            PingCallKitVoipManager.shared.reportCallEnded(callId: callId)
        }
        call.resolve()
    }
}
