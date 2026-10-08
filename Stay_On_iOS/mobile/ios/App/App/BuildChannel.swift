import Capacitor
import Foundation
import StoreKit

/// Tells the web layer where this build came from -- "appstore", "testflight",
/// "xcode" or "simulator" -- so analytics can separate real App Store players from
/// test installs. The same binary moves from TestFlight to the App Store, so this
/// can only be decided at runtime, from the signed AppTransaction environment.
@objc(BuildChannelPlugin)
public class BuildChannelPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BuildChannelPlugin"
    public let jsName = "BuildChannel"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise)
    ]

    @objc func get(_ call: CAPPluginCall) {
        Task {
            call.resolve(["channel": await BuildChannelPlugin.channel()])
        }
    }

    static func channel() async -> String {
        #if targetEnvironment(simulator)
        return "simulator"
        #else
        guard let result = try? await AppTransaction.shared else { return "unknown" }
        switch result.unsafePayloadValue.environment {
        case .production: return "appstore"
        case .sandbox: return "testflight"
        case .xcode: return "xcode"
        default: return "unknown"
        }
        #endif
    }
}

/// Bridge view controller that registers the app's local Capacitor plugins.
/// Main.storyboard points at this class instead of CAPBridgeViewController.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BuildChannelPlugin())
    }
}
