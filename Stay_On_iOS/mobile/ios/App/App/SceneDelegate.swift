import UIKit
import Capacitor

// iOS 27 traps at launch for apps that haven't adopted the UIScene lifecycle.
// The window and root CAPBridgeViewController come from Main.storyboard via
// UISceneStoryboardFile in Info.plist; URL opens and Universal Links now arrive
// here instead of the AppDelegate, so forward them to Capacitor's proxy.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
