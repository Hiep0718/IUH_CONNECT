import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

export default function App() {
  // Config & Auth State
  const [serverUrl, setServerUrl] = useState('http://10.0.2.2:8080');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);

  // Chat State
  const [receiverId, setReceiverId] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const handleAuth = async (isLogin: boolean) => {
    if (!serverUrl || !username || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    
    try {
      const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
      addLog(`Sending ${isLogin ? 'Login' : 'Register'} request to ${serverUrl}${endpoint}`);
      
      const response = await fetch(`${serverUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.accessToken) {
        setToken(data.accessToken);
        addLog(`${isLogin ? 'Login' : 'Register'} successful!`);
      } else {
        addLog(`Auth failed: ${JSON.stringify(data)}`);
        Alert.alert('Auth Failed', data.message || JSON.stringify(data));
      }
    } catch (error: any) {
      addLog(`Auth Exception: ${error.message}`);
      Alert.alert('Network Error', error.message);
    }
  };

  const connectWebSocket = () => {
    if (!token) return;
    
    const wsUrl = serverUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws/chat?token=' + token;
    addLog(`Connecting to WebSocket: ${wsUrl}`);
    
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onopen = () => {
      addLog('WebSocket Connected!');
    };
    
    ws.current.onmessage = (e) => {
      addLog(`Received: ${e.data}`);
    };
    
    ws.current.onerror = (e: any) => {
      addLog(`WebSocket Error: ${e.message}`);
    };
    
    ws.current.onclose = (e) => {
      addLog(`WebSocket Closed: ${e.code} ${e.reason}`);
    };
  };

  const disconnectWebSocket = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  };

  useEffect(() => {
    if (token) {
      connectWebSocket();
    }
    return () => {
      disconnectWebSocket();
    };
  }, [token]);

  const sendMessage = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      Alert.alert('Error', 'WebSocket is not connected');
      return;
    }
    if (!receiverId || !messageInput) {
      Alert.alert('Error', 'Please enter receiver ID and message');
      return;
    }

    const conversationId = [username, receiverId].sort().join('-');
    const payload = {
      senderId: username,
      receiverId: receiverId,
      content: messageInput,
      conversationId: conversationId,
      timestamp: 0,
    };

    const json = JSON.stringify(payload);
    addLog(`Sending: ${json}`);
    ws.current.send(json);
    setMessageInput('');
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>IUH Connect Test App</Text>
          
          <Text style={styles.label}>Server URL (Gateway)</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://10.0.2.2:8080"
            autoCapitalize="none"
          />
          
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            autoCapitalize="none"
          />
          
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            secureTextEntry
          />
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={() => handleAuth(true)}>
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
            <View style={{ width: 10 }} />
            <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={() => handleAuth(false)}>
              <Text style={styles.buttonTextOutline}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.logContainer}>
          <Text style={styles.logTitle}>Logs</Text>
          {logs.map((log, i) => <Text key={i} style={styles.logText}>{log}</Text>)}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Chat as: {username}</Text>
          <TouchableOpacity onPress={() => { setToken(null); disconnectWebSocket(); }} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Receiver Username</Text>
          <TextInput
            style={styles.input}
            value={receiverId}
            onChangeText={setReceiverId}
            placeholder="Enter receiver's username"
            autoCapitalize="none"
          />
        </View>

        <ScrollView 
          style={styles.logContainer}
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          <Text style={styles.logTitle}>Activity & Messages</Text>
          {logs.map((log, i) => <Text key={i} style={styles.logText}>{log}</Text>)}
        </ScrollView>

        <View style={styles.composeRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={messageInput}
            onChangeText={setMessageInput}
            placeholder="Type a message..."
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Text style={styles.buttonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2f3640',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#7f8fa6',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f1f2f6',
    borderWidth: 1,
    borderColor: '#dcdde1',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    marginBottom: 12,
    color: '#2f3640',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#00a8ff',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00a8ff',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonTextOutline: {
    color: '#00a8ff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutBtn: {
    padding: 8,
  },
  logoutText: {
    color: '#e84118',
    fontWeight: 'bold',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#2f3640',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  logTitle: {
    color: '#7f8fa6',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  logText: {
    color: '#4cd137',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendBtn: {
    backgroundColor: '#44bd32',
    padding: 12,
    borderRadius: 6,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
