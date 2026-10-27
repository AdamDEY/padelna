import { Button, cn, Tabs } from "heroui-native";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { ChoiceChips } from "@/components/choice-chips";
import { ClubsWeekBanner } from "@/components/clubs-week-banner";
import { ConnectSheet } from "@/components/connect-sheet";
import { IconButton } from "@/components/icon-button";
import { Page, usePageMargins } from "@/components/page";
import { ResultPostCard } from "@/components/result-post-card";
import { RISING_PLAYER_WIDTH, RisingPlayer } from "@/components/rising-player";
import { SectionHeader } from "@/components/section-header";
import { ShareMatchSheet } from "@/components/share-match-sheet";
import {
  clubPosts,
  clubsThisWeek,
  communityPosts,
  me,
  myClubNames,
  myFriendIds,
  risingPlayers,
  shareableMatches,
  tunisiaCities,
  tunisiaPosts,
} from "@/data/mock";
import type { ResultPost } from "@/types/post";

type Feed = "friends" | "clubs" | "tunisia";

const feeds: { value: Feed; label: string }[] = [
  { value: "friends", label: "Friends" },
  { value: "clubs", label: "My clubs" },
  { value: "tunisia", label: "All Tunisia" },
];

const ALL = "all";

export default function Community() {
  const [feed, setFeed] = useState<Feed>("friends");
  // The match whose players are shown in the Connect sheet
  const [connectPost, setConnectPost] = useState<ResultPost | null>(null);
  // Pending connection requests, kept while you switch feeds
  const [requestedIds, setRequestedIds] = useState<Set<string>>(() => new Set());
  const [isShareOpen, setIsShareOpen] = useState(false);

  function toggleRequest(playerId: string) {
    setRequestedIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  return (
    <Page>
      <Page.Body>
        <Page.Title action={<IconButton
              icon={Plus}
              label="Share a match"
              variant="primary"
              onPress={() => setIsShareOpen(true)}
            />}>
          Community
        </Page.Title>

        <FeedTabs value={feed} onChange={setFeed} />

        {feed === "friends" ? <FriendsFeed /> : null}
        {feed === "clubs" ? <ClubsFeed onConnect={setConnectPost} /> : null}
        {feed === "tunisia" ? <TunisiaFeed onConnect={setConnectPost} /> : null}
      </Page.Body>

      <ConnectSheet
        post={connectPost}
        onClose={() => setConnectPost(null)}
        meId={me.id}
        friendIds={myFriendIds}
        requestedIds={requestedIds}
        onToggleRequest={toggleRequest}
      />
      <ShareMatchSheet
        isOpen={isShareOpen}
        onOpenChange={setIsShareOpen}
        matches={shareableMatches}
      />
    </Page>
  );
}

/** Underline tabs; the line under them runs edge to edge. Must render inside Page. */
function FeedTabs({ value, onChange }: { value: Feed; onChange: (feed: Feed) => void }) {
  const margins = usePageMargins();

  return (
    // The wrapper draws the full-width line; the tabs stay inside the page margin
    <View className={cn("border-b border-line", margins.bleed, margins.inset)}>
      <Tabs value={value} onValueChange={(next) => onChange(next as Feed)} variant="secondary">
        <Tabs.List className="gap-[22px] border-b-0">
        <Tabs.Indicator className="border-b-[3px]" />
        {feeds.map((item) => (
          <Tabs.Trigger key={item.value} value={item.value} className="h-10 px-0">
            {({ isSelected }) => (
              <Tabs.Label
                className={cn(
                  "text-[15px]",
                  isSelected ? "font-bold text-foreground" : "font-semibold text-muted",
                )}
              >
                {item.label}
              </Tabs.Label>
            )}
          </Tabs.Trigger>
        ))}
        </Tabs.List>
      </Tabs>
    </View>
  );
}

function FriendsFeed() {
  return (
    <>
      {communityPosts.map((post) => (
        <ResultPostCard key={post.id} post={post} />
      ))}
    </>
  );
}

type FeedProps = {
  /** Opens the Connect sheet for a post */
  onConnect: (post: ResultPost) => void;
};

function ClubsFeed({ onConnect }: FeedProps) {
  const [club, setClub] = useState(ALL);
  const posts = clubPosts.filter((post) => club === ALL || post.clubName === club);

  return (
    <>
      <ChoiceChips
        options={[
          { value: ALL, label: "All my clubs" },
          ...myClubNames.map((name) => ({ value: name, label: name })),
        ]}
        value={club}
        onChange={setClub}
      />
      <ClubsWeekBanner
        matchesPlayed={clubsThisWeek.matchesPlayed}
        openForYourLevel={clubsThisWeek.openForYourLevel}
      />
      <PostList posts={posts} onConnect={onConnect} />
    </>
  );
}

function TunisiaFeed({ onConnect }: FeedProps) {
  const [city, setCity] = useState(ALL);
  const posts = tunisiaPosts.filter((post) => city === ALL || post.city === city);

  return (
    <>
      <ChoiceChips
        options={[
          { value: ALL, label: "All cities" },
          ...tunisiaCities.map((name) => ({ value: name, label: name })),
        ]}
        value={city}
        onChange={setCity}
      />

      <View className="gap-2.5">
        <SectionHeader size="sm" title="Rising this month" actionLabel="See all" />
        <Page.Carousel itemWidth={RISING_PLAYER_WIDTH} gap={10}>
          {risingPlayers.map((rising) => (
            <RisingPlayer key={rising.player.id} {...rising} />
          ))}
        </Page.Carousel>
      </View>

      <PostList posts={posts} onConnect={onConnect} />
    </>
  );
}

/** Posts from players you don't know yet; Connect opens the sheet to pick who. */
function PostList({ posts, onConnect }: { posts: ResultPost[] } & FeedProps) {
  if (posts.length === 0) {
    return (
      <View className="items-center gap-1 rounded-3xl border border-line bg-surface p-6">
        <Text className="font-bold text-[15px] text-foreground">No results here yet</Text>
        <Text className="text-center font-normal text-[14px] text-muted">
          Matches played here will show up once players share them.
        </Text>
      </View>
    );
  }

  return (
    <>
      {posts.map((post) => (
        <ResultPostCard
          key={post.id}
          post={post}
          headerAction={
            <Button
              size="sm"
              // Light blue, so a feed of Connect buttons doesn't compete with the screen's main action
              variant="secondary"
              onPress={() => onConnect(post)}
              hitSlop={6}
              className="h-8 rounded-[10px] px-3"
            >
              Connect
            </Button>
          }
        />
      ))}
    </>
  );
}
