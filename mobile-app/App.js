import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TextInput, Button, Text, SafeAreaView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
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

      let ws = null;

      function connect(url, token) {
        if (ws) {
          ws.close();
        }
        
        term.writeln('Connecting to ' + url + '...');
        
        try {
          ws = new WebSocket(url);
          
          ws.onopen = () => {
            term.writeln('Connected. Authenticating...');
            ws.send('auth:' + token);
          };
          
          ws.onmessage = (event) => {
            term.write(event.data);
          };
          
          ws.onclose = (event) => {
            term.writeln('\\r\\nConnection closed. Code: ' + event.code);
          };
          
          ws.onerror = (error) => {
            term.writeln('\\r\\nWebSocket Error. Check if the IP is correct and the server is running.');
            console.error('WebSocket Error:', error);
          };

          term.onData(data => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(data);
            }
          });
        } catch (e) {
          term.writeln('\\r\\nFailed to create WebSocket: ' + e.message);
          console.error('WebSocket Creation Error:', e);
        }
      }

      // Listen for messages from React Native
      document.addEventListener('message', function(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connect') {
            connect(data.url, data.token);
          } else if (data.type === 'disconnect') {
            if (ws) {
              ws.close();
            }
          }
        } catch (e) {
          console.error('Error parsing message', e);
        }
      });
      
      // For iOS
      window.addEventListener('message', function(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connect') {
            connect(data.url, data.token);
          } else if (data.type === 'disconnect') {
            if (ws) {
              ws.close();
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
  // Hardcoded for convenience based on your current setup
  const [serverUrl, setServerUrl] = useState('wss://terminal-connection-production.up.railway.app');
  const [token, setToken] = useState('kali-remote-secret-token-123');
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const webViewRef = useRef(null);

  const handleConnect = () => {
    if (isConnected) {
      webViewRef.current?.injectJavaScript(`
        window.postMessage(JSON.stringify({ type: 'disconnect' }), '*');
        true;
      `);
      setIsConnected(false);
    } else {
      webViewRef.current?.injectJavaScript(`
        window.postMessage(JSON.stringify({ 
          type: 'connect', 
          url: '${serverUrl}',
          token: '${token}'
        }), '*');
        true;
      `);
      setIsConnected(true);
      setShowSettings(false); // Hide settings when connecting
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
            <Text style={styles.title}>Kali Terminal</Text>
            <TouchableOpacity onPress={() => setShowSettings(!showSettings)}>
              <Text style={styles.settingsBtn}>⚙️</Text>
            </TouchableOpacity>
          </View>
          
          {showSettings && (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="ws://ip:port/ws/terminal"
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                placeholder="Auth Token"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
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
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingsBtn: {
    fontSize: 20,
  },
  inputContainer: {
    gap: 10,
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#fff',
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
