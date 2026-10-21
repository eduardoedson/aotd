import { ApolloProvider } from '@apollo/client';
import Root from './pages/Root';
import { anilist } from './services/backend';
import { useReleaseNotifications } from './services/notifications';

function ReleaseNotifications() {
  useReleaseNotifications();
  return null;
}

function App() {
  return (
    <ApolloProvider client={anilist}>
      <ReleaseNotifications />
      <Root />
    </ApolloProvider>
  );
}

export default App;
