import { ApolloClient, InMemoryCache, createHttpLink  } from '@apollo/client';
import { RetryLink } from '@apollo/client/link/retry';

const retryLink = new RetryLink({
  delays: {
    initial: 1000,
    max: 8000,
    jitter: true
  },
  attempts: {
    max: 3,
    retryIf: (error, _operation) => !!error
  },
});

export const anilist = new ApolloClient({
  link: retryLink.concat(createHttpLink({
    uri: 'https://graphql.anilist.co',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  })),
  cache: new InMemoryCache(),
});
