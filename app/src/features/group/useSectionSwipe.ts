import { useMemo, useRef } from 'react';
import { Animated, PanResponder, type PanResponderGestureState } from 'react-native';
import { motion } from '@/theme/tokens';

/**
 * Horizontal swipe between Group Detail's sections.
 *
 * BUILT ON PANRESPONDER, DELIBERATELY. The app has neither react-native-gesture-handler nor
 * Reanimated, and adding either means a native rebuild. PanResponder ships with React
 * Native and is enough for a one-page-at-a-time pager.
 *
 * IT MUST NEVER STEAL A VERTICAL SCROLL. The sections live inside the screen's vertical
 * ScrollView, and a feed is mostly scrolled up and down. So the gesture is only claimed
 * once the finger has travelled CLAIM_PX sideways AND at least twice as far sideways as
 * vertically. A slightly diagonal scroll stays a scroll; a tap or a long-press on a row is
 * never claimed at all.
 *
 * Children get first refusal: this uses the bubbling `onMoveShouldSetPanResponder`, not the
 * capture phase, so a horizontally scrolling chip row inside a section keeps its own swipe.
 *
 * ONE SECTION PER SWIPE. However far or fast the swipe, it moves to the neighbour. At the
 * first and last section the content rubber-bands and springs back instead of switching.
 */

const CLAIM_PX = 18;
/** Fraction of the width a slow drag must cover to switch. */
const COMMIT_FRACTION = 0.28;
/** A flick this fast switches even when short — but never below FLICK_MIN_PX. */
const FLICK_VELOCITY = 0.45;
const FLICK_MIN_PX = 40;
/** Resistance past either end. */
const EDGE_RESISTANCE = 0.25;

/** Whether a movement so far is a deliberate sideways swipe rather than a scroll or a tap. */
export const shouldClaimSwipe = (dx: number, dy: number): boolean =>
  Math.abs(dx) > CLAIM_PX && Math.abs(dx) > Math.abs(dy) * 2;

/**
 * Where a released swipe lands: the neighbour's index, or null to spring back. Never more
 * than one step, and never past either end.
 */
export const swipeTarget = (
  at: number,
  total: number,
  dx: number,
  vx: number,
  width: number,
): number | null => {
  const direction = dx < 0 ? 1 : -1;
  const target = at + direction;
  const far =
    Math.abs(dx) > width * COMMIT_FRACTION ||
    (Math.abs(vx) > FLICK_VELOCITY && Math.abs(dx) > FLICK_MIN_PX);
  if (!far || target < 0 || target >= total) return null;
  return target;
};

export function useSectionSwipe({
  index,
  count,
  width,
  onSwipeTo,
}: {
  index: number;
  count: number;
  width: number;
  /** Called once the outgoing slide finishes, with the neighbour to show. */
  onSwipeTo: (index: number) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  // The responder is created once; these refs keep it reading current values.
  const live = useRef({ index, count, width, onSwipeTo });
  live.current = { index, count, width, onSwipeTo };

  const springHome = (): void => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 9, tension: 80 }).start();
  };

  /** Slides new content in from the side it logically comes from. */
  const enterFrom = (direction: 1 | -1): void => {
    translateX.setValue(direction * live.current.width * 0.3);
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 10, tension: 90 }).start();
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, g: PanResponderGestureState) =>
          shouldClaimSwipe(g.dx, g.dy),

        // Once a sideways swipe is under way, see it through.
        onPanResponderTerminationRequest: () => false,

        onPanResponderMove: (_event, g) => {
          const { index: at, count: total } = live.current;
          const pastEdge = (at === 0 && g.dx > 0) || (at === total - 1 && g.dx < 0);
          translateX.setValue(pastEdge ? g.dx * EDGE_RESISTANCE : g.dx);
        },

        onPanResponderRelease: (_event, g) => {
          const { index: at, count: total, width: w, onSwipeTo: go } = live.current;
          const direction: 1 | -1 = g.dx < 0 ? 1 : -1;
          const target = swipeTarget(at, total, g.dx, g.vx, w);

          if (target === null) {
            springHome();
            return;
          }

          Animated.timing(translateX, {
            toValue: -direction * w,
            duration: motion.duration.fast,
            useNativeDriver: true,
          }).start(() => {
            go(target);
            enterFrom(direction);
          });
        },

        // Something else (a native scroller) took over: put the content back.
        onPanResponderTerminate: springHome,
      }),
    // Created once on purpose; current values are read through `live`.
    [],
  );

  return { panHandlers: responder.panHandlers, translateX, enterFrom };
}
