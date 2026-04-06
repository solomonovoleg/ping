import UIKit

/**
 * UIScene lifecycle — убирает предупреждение «CLIENT OF UIKIT REQUIRES UPDATE: … UIScene».
 * Корень — тот же Main.storyboard с CAPBridgeViewController (Capacitor).
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        guard let root = storyboard.instantiateInitialViewController() else { return }

        let win = UIWindow(windowScene: windowScene)
        win.rootViewController = root
        win.makeKeyAndVisible()
        window = win
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        window = nil
    }
}
