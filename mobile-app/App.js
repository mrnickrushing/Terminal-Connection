import React, { useState, useRef } from 'react';
import { StyleSheet, View, TextInput, Text, SafeAreaView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';

const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.3.0/css/xterm.css" />
    <script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.3.0/lib/xterm.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.8.0/lib/addon-fit.js"></script>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #000;
        overflow: hidden;
      }
      #terminal {
        width: 100vw;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <div id="terminal"></div>
    <script>
      const term = new Terminal({
        cursorBlink: true,
        theme: {
          background: '#000000',
          foreground: '#ffffff'
        }
      });
      const fitAddon = new FitAddon.FitAddon();
      term.loadAddon(fitAddon);
      term.open(document.getElementById('terminal'));
      fitAddon.fit();

      window.addEventListener('resize', () => {
        fitAddon.fit();
      });

      let socket = null;

      // Register onData once — not inside connect() to avoid stacking handlers
      term.onData(data => {
        if (socket && socket.connected) {
          socket.emit('data', data);
        }
      });

      function notifyRN(type, payload) {
        const msg = JSON.stringify({ type, ...payload });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(msg);
        }
      }

      function loadSocketIO(callback) {
        if (typeof io !== 'undefined') { callback(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
        script.onload = callback;
        script.onerror = () => {
          term.writeln('\\r\\nError: Socket.IO client failed to load. Check network connection.');
          notifyRN('disconnected', {});
        };
        document.head.appendChild(script);
      }

      function connect(url, token) {
        if (socket) {
          socket.off();
          socket.disconnect();
          socket = null;
        }

        // Socket.io needs http(s):// not ws(s)://
        const httpUrl = url.replace(/^wss:\\/\\//, 'https://').replace(/^ws:\\/\\//, 'http://');
        term.writeln('Connecting to ' + httpUrl + '...');

        loadSocketIO(() => {
        try {
          const thisSocket = io(httpUrl, { transports: ['websocket', 'polling'] });
          socket = thisSocket;

          thisSocket.on('connect', () => {
            if (socket !== thisSocket) return;
            term.writeln('Connected. Authenticating...');
            thisSocket.emit('auth', token);
            notifyRN('connected', {});
          });

          thisSocket.on('data', (msg) => {
            if (socket !== thisSocket) return;
            term.write(msg);
          });

          thisSocket.on('disconnect', () => {
            if (socket !== thisSocket) return;
            term.writeln('\\r\\nDisconnected.');
            notifyRN('disconnected', {});
          });

          thisSocket.on('connect_error', (err) => {
            if (socket !== thisSocket) return;
            term.writeln('\\r\\nConnection error: ' + err.message);
            notifyRN('disconnected', {});
          });
        } catch (e) {
          term.writeln('\\r\\nFailed to connect: ' + e.message);
          notifyRN('disconnected', {});
        }
        }); // loadSocketIO
      }

      // Use window.addEventListener only — covers both iOS and Android in react-native-webview
      window.addEventListener('message', function(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connect') {
            connect(data.url, data.token);
          } else if (data.type === 'disconnect') {
            if (socket) {
              socket.disconnect();
            }
          }
        } catch (e) {
          console.error('Error parsing message', e);
        }
      });
    </script>
  </body>
</html>
`;

export default function App() {
  const [serverUrl, setServerUrl] = useState('wss://terminal-connection-production.up.railway.app');
  const [token, setToken] = useState('kali-remote-secret-token-123');
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const webViewRef = useRef(null);

  const sendToWebView = (payload) => {
    // JSON.stringify(json) produces a properly escaped JS string literal,
    // avoiding template literal injection if url/token contain ${...}
    const json = JSON.stringify(payload);
    webViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(json)} }));
      true;
    `);
  };

  const handleConnect = () => {
    if (isConnected) {
      sendToWebView({ type: 'disconnect' });
      setIsConnected(false);
    } else {
      sendToWebView({ type: 'connect', url: serverUrl, token });
      setShowSettings(false);
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'connected') {
        setIsConnected(true);
      } else if (data.type === 'disconnected') {
        setIsConnected(false);
      }
    } catch (e) {
      // ignore non-JSON messages
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Kali Terminal</Text>
              <View style={[styles.statusDot, isConnected ? styles.statusDotConnected : styles.statusDotDisconnected]} />
            </View>
            <TouchableOpacity onPress={() => setShowSettings(!showSettings)}>
              <Text style={styles.settingsBtn}>⚙️</Text>
            </TouchableOpacity>
          </View>

          {showSettings && (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="wss://relay-server-url"
                placeholderTextColor="#999"
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TextInput
                style={styles.input}
                placeholder="Auth Token"
                placeholderTextColor="#999"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={true}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.connectBtn, isConnected ? styles.disconnectBtn : null]}
            onPress={handleConnect}
          >
            <Text style={styles.connectBtnText}>
              {isConnected ? "Disconnect" : "Connect to Kali"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.terminalContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={styles.webview}
            scrollEnabled={false}
            bounces={false}
            keyboardDisplayRequiresUserAction={false}
            hideKeyboardAccessoryView={true}
            onMessage={handleWebViewMessage}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  header: {
    padding: 15,
    backgroundColor: '#2d2d2d',
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d3d',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotConnected: {
    backgroundColor: '#30d158',
  },
  statusDotDisconnected: {
    backgroundColor: '#636366',
  },
  settingsBtn: {
    fontSize: 20,
  },
  inputContainer: {
    gap: 10,
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#3d3d3d',
    color: '#fff',
    padding: 10,
    borderRadius: 5,
    fontSize: 14,
  },
  connectBtn: {
    backgroundColor: '#007aff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disconnectBtn: {
    backgroundColor: '#ff3b30',
  },
  connectBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  terminalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});
