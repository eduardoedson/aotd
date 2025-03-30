import Root from './pages/Root';
import { ApolloProvider } from '@apollo/client';
import { anilist } from './services/backend'
 
function App() {
  return (
    <ApolloProvider client={anilist}>
        <Root />
    </ApolloProvider>
  );
}

export default App;
