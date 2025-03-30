import { ApolloClient, InMemoryCache, createHttpLink  } from '@apollo/client';
import { RetryLink } from '@apollo/client/link/retry';

const retryLink = new RetryLink({
  delays: {
    initial: 90000,
    max: 120000,
    jitter: true
  },
  attempts: {
    max: 5,
    retryIf: (error, _operation) => !!error
  },
});

export const anilist = new ApolloClient({
  link: retryLink.concat(createHttpLink({ uri: 'https://graphql.anilist.co' })),
  cache: new InMemoryCache(),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});