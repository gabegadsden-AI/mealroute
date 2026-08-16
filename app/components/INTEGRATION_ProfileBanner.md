// ============================================
// HOW TO WIRE ProfileCompletionBanner INTO app/page.tsx
// ============================================
//
// 1. Add the import at the top of page.tsx (near the other component imports):
//
//    import ProfileCompletionBanner from "./components/ProfileCompletionBanner";
//
// 2. Find where the dashboard renders (look for the main content area,
//    usually right after the tab header). Add this JSX block:
//
//    <ProfileCompletionBanner
//      hasCalorieGoal={!!(profile?.calorie_goal && Number(profile.calorie_goal) > 0)}
//      hasMacroGoals={
//        profile?.protein_goal_g !== null
//        && profile?.carbs_goal_g !== null
//        && profile?.fat_goal_g !== null
//      }
//      onOpenGoals={() => setModal("goals")}
//    />
//
// 3. Make sure `setModal` is the same state setter used for opening the
//    goals editor. In the current code it's: const [modal, setModal] = useState(...)
//    and the goals editor opens when modal === "goals".
//
// That's it — the banner appears automatically when calorie_goal or macro
// goals are null, and disappears once the user sets them.
