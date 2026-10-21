import Root from './pages/Root';
import { useReleaseNotifications } from './services/notifications';

function ReleaseNotifications() {
  useReleaseNotifications();
  return null;
}

function App() {
  return (
    <>
      <ReleaseNotifications />
      <Root />
    </>
  );
}

export default App;
