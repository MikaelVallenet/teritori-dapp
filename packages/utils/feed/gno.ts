import { Post, Reaction } from "../../api/feed/v1/feed";
import { getNetworkObjectId, getUserId } from "../../networks";

type GnoPost = {
  id: number;
  parentID: number;
  feedID: number;
  category: number;
  metadata: string;
  reactions: {
    [key: string]: number;
  };
  commentsCount: number;
  creator: string;
  tipAmount: number;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
};

export const decodeGnoPost = (networkId: string, gnoPost: GnoPost): Post => {
  const reactions: Reaction[] = [];

  for (const [icon, count] of Object.entries(gnoPost.reactions)) {
    reactions.push({ icon, count, ownState: false }); // FIXME: find a way to get the user's reaction state from on-chain post
  }

  const localIdentifier = gnoPost.id ? "" + gnoPost.id : "";

  const post: Post = {
    category: gnoPost.category,
    isDeleted: gnoPost.deleted,
    networkId,
    identifier: localIdentifier,
    localIdentifier,
    id: getNetworkObjectId(networkId, localIdentifier),
    metadata: gnoPost.metadata,
    parentPostIdentifier: gnoPost.parentID ? "" + gnoPost.parentID : "",
    subPostLength: gnoPost.commentsCount,
    authorId: getUserId(networkId, gnoPost.creator),
    createdAt: gnoPost.createdAt,
    tipAmount: gnoPost.tipAmount,
    reactions,
    premiumLevel: 0,
  };

  return post;
};
