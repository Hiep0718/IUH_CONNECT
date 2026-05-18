/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {registerBackgroundMessageHandler} from './src/services/notificationService';

registerBackgroundMessageHandler();

AppRegistry.registerComponent(appName, () => App);
