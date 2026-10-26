import { router } from "expo-router";
import { cn } from "heroui-native";
import { ChevronLeft } from "lucide-react-native";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton } from "@/components/icon-button";

/**
 * Screen layout from design.md, built as a compound component:
 *
 *   <Page variant="auth">
 *     <Page.Header back title="Create a match" />
 *     <Page.Body>
 *       <Page.Title>Tell us about you</Page.Title>
 *       ...
 *     </Page.Body>
 *     <Page.Footer>
 *       <Button size="lg">Continue</Button>
 *     </Page.Footer>
 *   </Page>
 *
 * Page owns the background, safe areas, side margins and keyboard handling,
 * so screens never set those themselves.
 */

type PageVariant = "app" | "auth";

// Side margins: 20 px on app screens, 24 px on auth, setup and onboarding
const marginClass: Record<PageVariant, string> = {
  app: "px-5",
  auth: "px-6",
};

// Cancels the side margin so a row can run edge to edge
const bleedClass: Record<PageVariant, string> = {
  app: "-mx-5",
  auth: "-mx-6",
};

// Space between the screen edges and the first / last element
const TOP_GAP = 8;
const BOTTOM_ACTION_GAP = 34;
const KEYBOARD_GAP = 12;
// Breathing room under the last element when nothing is pinned below it,
// e.g. above the tab bar, whose inset iOS adds to the scroll view itself
const END_GAP = 16;
const SECTION_GAP = "gap-5";

type PageContextValue = { variant: PageVariant; hasFooter: boolean };

const PageContext = createContext<PageContextValue | null>(null);

function usePage() {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error("Page.Header, Page.Body and Page.Footer must be used inside <Page>.");
  }
  return context;
}

type PageProps = {
  variant?: PageVariant;
  children: ReactNode;
};

function PageRoot({ variant = "app", children }: PageProps) {
  const insets = useSafeAreaInsets();
  // Without a footer, the body itself has to clear the home indicator
  const hasFooter = Children.toArray(children).some(
    (child) => isValidElement(child) && child.type === PageFooter,
  );

  return (
    <PageContext.Provider value={{ variant, hasFooter }}>
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ paddingTop: insets.top + TOP_GAP }}
      >
        {children}
      </KeyboardAvoidingView>
    </PageContext.Provider>
  );
}

type PageHeaderProps = {
  /** Show a back button. Pass a function to replace the default router.back(). */
  back?: boolean | (() => void);
  /** Compact centred title for sheets and sub-pages. Main screens use Page.Title instead. */
  title?: string;
  /** Actions on the right, usually IconButtons */
  children?: ReactNode;
};

function PageHeader({ back, title, children }: PageHeaderProps) {
  const { variant } = usePage();
  const onBack = typeof back === "function" ? back : () => router.back();

  return (
    <View className={cn("min-h-11 flex-row items-center justify-between pb-4", marginClass[variant])}>
      <View className="min-w-11 flex-row">
        {back ? <IconButton icon={ChevronLeft} label="Back" onPress={onBack} /> : null}
      </View>
      {title ? (
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          className="flex-1 px-2 text-center font-black text-[20px] tracking-[-0.3px] text-foreground"
        >
          {title}
        </Text>
      ) : null}
      <View className="min-w-11 flex-row justify-end gap-2">{children}</View>
    </View>
  );
}

type PageBodyProps = {
  /** Scrolls by default. Set false for screens that must fit without scrolling. */
  scroll?: boolean;
  className?: string;
  children: ReactNode;
};

function PageBody({ scroll = true, className, children }: PageBodyProps) {
  const { variant, hasFooter } = usePage();
  const insets = useSafeAreaInsets();
  const contentClass = cn(marginClass[variant], SECTION_GAP, className);
  const paddingBottom = hasFooter ? 24 : Math.max(insets.bottom, BOTTOM_ACTION_GAP) + END_GAP;

  if (!scroll) {
    return (
      <View className={cn("flex-1", contentClass)} style={{ paddingBottom }}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName={cn("grow", contentClass)}
      contentContainerStyle={{ paddingBottom }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

type PageTitleProps = {
  /** Optional uppercase label above the title, e.g. "LEVEL QUIZ" */
  eyebrow?: string;
  /** Optional supporting text below the title */
  description?: string;
  /** Optional button on the right of the title, usually an IconButton */
  action?: ReactNode;
  children: string;
};

/** H1 screen title from design.md: 30 px / 900. */
function PageTitle({ eyebrow, description, action, children }: PageTitleProps) {
  return (
    <View className="gap-1.5">
      {eyebrow ? (
        <Text className="font-bold text-[13px] uppercase tracking-[0.7px] text-muted">{eyebrow}</Text>
      ) : null}
      <View className="flex-row items-center justify-between gap-3">
        <Text
          accessibilityRole="header"
          className="flex-1 font-black text-[30px] leading-[35px] tracking-[-0.5px] text-foreground"
        >
          {children}
        </Text>
        {action}
      </View>
      {description ? (
        <Text className="font-normal text-[16px] leading-6 text-ink-2">{description}</Text>
      ) : null}
    </View>
  );
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // iOS has "will" events so the footer moves with the keyboard; Android only has "did"
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}

type PageCarouselProps = {
  /** Card width, so scrolling snaps card by card. Leave out for items of mixed widths (chips). */
  itemWidth?: number;
  /** Space between cards, in px */
  gap?: number;
  children: ReactNode;
};

/**
 * Horizontal carousel inside Page.Body. It runs to the screen edges while the
 * first card lines up with the margin; size cards so about 1.5 show (design.md).
 */
function PageCarousel({ itemWidth, gap = 12, children }: PageCarouselProps) {
  const { variant } = usePage();

  return (
    <ScrollView
      horizontal
      // ScrollView grows by default; on a short page it would take the spare height
      className={cn("grow-0", bleedClass[variant])}
      contentContainerClassName={marginClass[variant]}
      contentContainerStyle={{ gap }}
      showsHorizontalScrollIndicator={false}
      snapToInterval={itemWidth ? itemWidth + gap : undefined}
      decelerationRate={itemWidth ? "fast" : "normal"}
    >
      {children}
    </ScrollView>
  );
}

type PageFooterProps = {
  className?: string;
  children: ReactNode;
};

/** Pinned bottom area for the screen's one primary action, 34 px from the bottom edge. */
function PageFooter({ className, children }: PageFooterProps) {
  const { variant } = usePage();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  // Above the keyboard there is no home indicator to clear
  const paddingBottom = keyboardVisible ? KEYBOARD_GAP : Math.max(insets.bottom, BOTTOM_ACTION_GAP);

  return (
    <View
      className={cn("gap-3 pt-3", marginClass[variant], className)}
      style={{ paddingBottom }}
    >
      {children}
    </View>
  );
}

export const Page = Object.assign(PageRoot, {
  Header: PageHeader,
  Body: PageBody,
  Title: PageTitle,
  Carousel: PageCarousel,
  Footer: PageFooter,
});
