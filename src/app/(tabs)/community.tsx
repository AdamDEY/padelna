import { Plus } from "lucide-react-native";

import { IconButton } from "@/components/icon-button";
import { Page } from "@/components/page";
import { ResultPostCard } from "@/components/result-post-card";
import { communityPosts } from "@/data/mock";

export default function Community() {
  return (
    <Page>
      <Page.Body>
        <Page.Title action={<IconButton icon={Plus} label="Share a match" variant="primary" />}>
          Community
        </Page.Title>

        {communityPosts.map((post) => (
          <ResultPostCard key={post.id} post={post} />
        ))}
      </Page.Body>
    </Page>
  );
}
