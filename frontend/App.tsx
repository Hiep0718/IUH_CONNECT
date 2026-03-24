/**
 * IUH Connect - Chat Application
 * @format
 */

import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import ChatScreen from './src/screens/ChatScreen';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#000' : '#fff'}
      />
      <ChatScreen />
    </>
  );
}

export default App;
