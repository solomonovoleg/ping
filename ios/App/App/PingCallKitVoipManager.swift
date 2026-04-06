import CallKit
import Capacitor
import Foundation
import PushKit

/**
 * PushKit (VoIP) + CallKit: системный экран входящего звонка на iOS.
 * Данные звонка приходят в payload от сервера (APNs voip); JS поднимает WebRTC после answer.
 */
final class PingCallKitVoipManager: NSObject, PKPushRegistryDelegate, CXProviderDelegate {
    static let shared = PingCallKitVoipManager()

    private var pushRegistry: PKPushRegistry?
    private let provider: CXProvider
    private weak var bridgePlugin: PingCallKitVoipPlugin?

    private var uuidByCallId: [String: UUID] = [:]
    private var metaByUuid: [UUID: [String: String]] = [:]
    private let pendingLock = NSLock()
    private var pendingActions: [[String: String]] = []

    private override init() {
        let cfg = CXProviderConfiguration(localizedName: "PING")
        cfg.supportsVideo = true
        cfg.maximumCallsPerCallGroup = 1
        cfg.maximumCallGroups = 1
        cfg.includesCallsInRecents = false
        provider = CXProvider(configuration: cfg)
        super.init()
        provider.setDelegate(self, queue: nil)
    }

    func attach(plugin: PingCallKitVoipPlugin?) {
        bridgePlugin = plugin
        flushPendingActions()
    }

    func startVoipPushRegistry() {
        guard pushRegistry == nil else { return }
        let reg = PKPushRegistry(queue: .main)
        reg.desiredPushTypes = [.voIP]
        reg.delegate = self
        pushRegistry = reg
    }

    // MARK: - PKPushRegistryDelegate

    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        DispatchQueue.main.async {
            self.bridgePlugin?.notifyListeners("pingVoipToken", data: ["token": token])
        }
    }

    func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {}

    func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        guard type == .voIP else {
            completion()
            return
        }
        let d = payload.dictionaryPayload
        guard let callId = d["callId"] as? String, !callId.isEmpty else {
            completion()
            return
        }

        let caller = (d["fromDisplayName"] as? String) ?? "PING"
        let chatId = (d["chatId"] as? String) ?? ""
        let fromUserId = (d["fromUserId"] as? String) ?? ""
        let mediaType = (d["mediaType"] as? String) ?? "audio"

        let uuid = stableUuid(forCallId: callId)
        let meta: [String: String] = [
            "callId": callId,
            "chatId": chatId,
            "fromUserId": fromUserId,
            "mediaType": mediaType,
            "fromDisplayName": caller,
        ]
        metaByUuid[uuid] = meta

        let upd = CXCallUpdate()
        upd.hasVideo = (mediaType == "video")
        upd.localizedCallerName = caller
        upd.remoteHandle = CXHandle(type: .generic, value: caller)

        provider.reportNewIncomingCall(with: uuid, update: upd) { _ in
            completion()
        }
    }

    private func stableUuid(forCallId callId: String) -> UUID {
        if let u = uuidByCallId[callId] { return u }
        let u = UUID()
        uuidByCallId[callId] = u
        return u
    }

    private func emitAction(_ fields: [String: String]) {
        if let plugin = bridgePlugin {
            plugin.notifyListeners("pingCallKitAction", data: fields)
        } else {
            pendingLock.lock()
            pendingActions.append(fields)
            pendingLock.unlock()
        }
    }

    func flushPendingActions() {
        guard let plugin = bridgePlugin else { return }
        pendingLock.lock()
        let batch = pendingActions
        pendingActions.removeAll()
        pendingLock.unlock()
        for item in batch {
            plugin.notifyListeners("pingCallKitAction", data: item)
        }
    }

    func copyAndClearPendingActions() -> [[String: String]] {
        pendingLock.lock()
        let batch = pendingActions
        pendingActions.removeAll()
        pendingLock.unlock()
        return batch
    }

    func reportCallEnded(callId: String) {
        guard let uuid = uuidByCallId[callId] else { return }
        provider.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
        cleanup(uuid: uuid, callId: callId)
    }

    private func cleanup(uuid: UUID, callId: String) {
        metaByUuid.removeValue(forKey: uuid)
        uuidByCallId.removeValue(forKey: callId)
    }

    // MARK: - CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {
        uuidByCallId.removeAll()
        metaByUuid.removeAll()
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        let uuid = action.callUUID
        guard let meta = metaByUuid[uuid] else {
            action.fail()
            return
        }
        var payload = meta
        payload["action"] = "answer"
        emitAction(payload)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        let uuid = action.callUUID
        if let meta = metaByUuid[uuid], let callId = meta["callId"] {
            var payload = meta
            payload["action"] = "reject"
            emitAction(payload)
            cleanup(uuid: uuid, callId: callId)
        }
        action.fulfill()
    }
}
