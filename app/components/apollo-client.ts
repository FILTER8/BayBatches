import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

const HTTP_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL; // Changed from NEXT_PUBLIC_GRAPHQL_ENDPOINT
const THE_GRAPH_API_KEY = process.env.NEXT_PUBLIC_THE_GRAPH_API_KEY;

if (!HTTP_ENDPOINT) {
  throw new Error('NEXT_PUBLIC_GRAPHQL_URL is not defined in environment variables');
}
if (!THE_GRAPH_API_KEY) {
  console.warn('NEXT_PUBLIC_THE_GRAPH_API_KEY is not defined; authentication may be required for some subgraphs');
}

const httpLink = new HttpLink({
  uri: HTTP_ENDPOINT,
  headers: THE_GRAPH_API_KEY ? { Authorization: `Bearer ${THE_GRAPH_API_KEY}` } : {},
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    query: { fetchPolicy: 'cache-first', errorPolicy: 'all' },
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});

export default client;

export function initializeApollo() {
  return client;
}