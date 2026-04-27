import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TextInput, Button, Text, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
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
        
        ws = new WebSocket(url);
        
        ws.onopen = () => {
          term.writeln('Connected. Authenticating...');
          ws.send('auth:' + token);
        };
        
        ws.onmessage = (event) => {
          term.write(event.data);
        };
        
        ws.onclose = () => {
          term.writeln('\\r\\nConnection closed.');
        };
        
        ws.onerror = (error) => {
          term.writeln('\\r\\nWebSocket Error.');
        };

        term.onData(data => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });
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
  const [serverUrl, setServerUrl] = useState('ws://192.168.1.100:8000/ws/terminal');
  const [token, setToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
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
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Kali Terminal Remote</Text>
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
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button 
              title={isConnected ? "Disconnect" : "Connect"} 
              onPress={handleConnect} 
              color={isConnected ? "#ff3b30" : "#007aff"}
            />
          </View>
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
    padding: 10,
    backgroundColor: '#2d2d2d',
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d3d',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  inputContainer: {
    gap: 10,
  },
  input: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    fontSize: 14,
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
