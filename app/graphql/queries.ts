import { gql } from '@apollo/client';

export const LEADERBOARD_QUERY = gql`
  query Leaderboard {
    users(first: 1000, where: { or: [{ tokensOwned_: { id_not: null } }, { editionsCreated_: { id_not: null } }] }) {
      id
      tokensOwned(first: 1000) {
        id
        edition { id glyphContract { id } }
        tokenId
      }
      editionsCreated(first: 1000) {
        id
        glyphContract { id }
      }
    }
  }
`;

export const USER_PROFILE_QUERY = gql`
  query UserProfile($id: ID!) {
    user(id: $id) {
      id
      tokensOwned(first: 1000) {
        id
        edition {
          id
          glyphContract { id }
          name
          totalSupply
          editionSize
          price
          isFreeMint
          paused
        }
        tokenId
      }
      editionsCreated(first: 1000) {
        id
        glyphContract { id }
        name
        totalSupply
        editionSize
        price
        isFreeMint
        paused
      }
    }
  }
`;

export const ALL_EDITIONS_QUERY = gql`
  query AllEditions {
    editions(
      first: 100
      skip: 0
      orderBy: createdAt
      orderDirection: desc
      where: { removed: false }
    ) {
      id
      name
      creator { id }
      createdAt
      palette
      totalSupply
      editionSize
      price
      isFreeMint
      paused
      glyphContract { id }
    }
  }
`;

export const EDITION_QUERY = gql`
  query Edition($id: ID!) {
    edition(id: $id) {
      id
      name
      creator { id }
      createdAt
      palette
      totalSupply
      editionSize
      price
      isFreeMint
      paused
      glyphContract { id }
    }
  }
`;