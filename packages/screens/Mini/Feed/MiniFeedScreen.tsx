import React, { useMemo, useState } from "react";
import { useWindowDimensions, View } from "react-native";

import { ArticlesFeedScreen } from "./ArticlesFeedScreen";
import { JungleFeedScreen } from "./JungleFeedScreen";
import { MusicFeedScreen } from "./MusicFeedScreen";
import { PictureFeedScreen } from "./PictureFeedScreen";
import { VideoFeedScreen } from "./VideoFeedScreen";

import { PostsRequest } from "@/api/feed/v1/feed";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SpacerColumn } from "@/components/spacer";
import { RoundedTabs } from "@/components/tabs/RoundedTabs";
import { useSelectedNetworkId } from "@/hooks/useSelectedNetwork";
import { ScreenFC } from "@/utils/navigation";
import { layout } from "@/utils/style/layout";

const feedScreenTabItems = {
  jungle: {
    name: "Jungle",
  },
  musics: {
    name: "Music",
  },
  pics: {
    name: "Pics",
  },
  videos: {
    name: "Videos",
  },
  articles: {
    name: "Articles",
  },
};

export const MiniFeedScreen: ScreenFC<"MiniFeeds"> = ({
  navigation,
  route,
}) => {
  const [selectedTab, setSelectedTab] =
    useState<keyof typeof feedScreenTabItems>("jungle");
  const selectedNetworkId = useSelectedNetworkId();
  const { width } = useWindowDimensions();
  const defaultFeedRequest = useMemo(() => {
    return getDefaultFeedRequest(selectedNetworkId);
  }, [selectedNetworkId]);

  return (
    <ScreenContainer
      headerChildren={<></>}
      responsive
      fullWidth
      footerChildren={null}
      noScroll
      mobileTitle="Feeds"
    >
      <View
        style={{
          flex: 1,
          width,
          paddingHorizontal: layout.spacing_x2,
        }}
      >
        <SpacerColumn size={1} />
        <RoundedTabs
          items={feedScreenTabItems}
          onSelect={(key) => setSelectedTab(key)}
          selected={selectedTab}
          style={{
            height: 36,
            maxHeight: 36,
          }}
        />

        <SpacerColumn size={2} />

        {selectedTab === "jungle" && (
          <JungleFeedScreen req={defaultFeedRequest} />
        )}
        {selectedTab === "musics" && <MusicFeedScreen />}
        {selectedTab === "pics" && <PictureFeedScreen />}
        {selectedTab === "videos" && <VideoFeedScreen />}
        {selectedTab === "articles" && <ArticlesFeedScreen />}
      </View>
    </ScreenContainer>
  );
};

const getDefaultFeedRequest = (networkId: string) => {
  const req: Partial<PostsRequest> = {
    filter: {
      networkId,
      categories: [],
      user: "",
      mentions: [],
      hashtags: [],
      premiumLevelMin: 0,
      premiumLevelMax: -1,
    },
    limit: 20,
    offset: 0,
  };
  return req;
};
