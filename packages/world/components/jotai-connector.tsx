import { useSetAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { useLayoutEffect } from "react";
import {
  useLocation,
  useNavigate,
  useNavigation,
  useRevalidator,
} from "react-router";

import { hydrationAtom } from "~/lib/hydration-atom";
import { locationAtom } from "~/lib/location-atom";
import { navigationAtom } from "~/lib/navigation-atom";
import { navigationCountAtom } from "~/lib/navigation-count-atom";
import { navigatorAtom } from "~/lib/navigator-atom";
import { revalidatorAtom } from "~/lib/revalidator-atom";

export function JotaiConnector() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const revalidator = useRevalidator();

  useHydrateAtoms([
    [locationAtom, location],
    [navigationAtom, navigation],
    [navigatorAtom, { navigate }],
    [revalidatorAtom, revalidator],
  ]);

  const setLocation = useSetAtom(locationAtom);
  const setNavigation = useSetAtom(navigationAtom);
  const setNavigationCount = useSetAtom(navigationCountAtom);
  const setNavigator = useSetAtom(navigatorAtom);
  const setRevalidator = useSetAtom(revalidatorAtom);
  const setHydration = useSetAtom(hydrationAtom);

  useLayoutEffect(() => {
    setNavigation(navigation);
    setNavigationCount((count) => count + 1);
  }, [navigation, setNavigation, setNavigationCount]);

  useLayoutEffect(() => {
    setLocation(location);
  }, [location, setLocation]);

  useLayoutEffect(() => {
    setNavigator({ navigate });
  }, [navigate, setNavigator]);

  useLayoutEffect(() => {
    setRevalidator(revalidator);
  }, [revalidator, setRevalidator]);

  useLayoutEffect(() => {
    setHydration();
  }, [setHydration]);

  return null;
}
