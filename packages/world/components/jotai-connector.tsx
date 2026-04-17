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
import { navigationCountAtom } from "~/lib/navigation-count-atom";
import { navigationDataAtom } from "~/lib/navigation-data-atom";
import { navigatorAtom } from "~/lib/navigator-atom";
import { revalidatorAtom } from "~/lib/revalidator-atom";

export function JotaiConnector() {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const location = useLocation();
  const navigationData = useNavigation();

  useHydrateAtoms([
    [navigatorAtom, { navigate }],
    [revalidatorAtom, revalidator],
    [locationAtom, location],
    [navigationDataAtom, navigationData],
  ]);

  const setNavigator = useSetAtom(navigatorAtom);
  const setRevalidator = useSetAtom(revalidatorAtom);
  const setLocation = useSetAtom(locationAtom);
  const setNavigationData = useSetAtom(navigationDataAtom);
  const setNavigationCount = useSetAtom(navigationCountAtom);
  const setHydration = useSetAtom(hydrationAtom);

  useLayoutEffect(() => {
    setNavigator({ navigate });
  }, [navigate, setNavigator]);

  useLayoutEffect(() => {
    setRevalidator(revalidator);
  }, [revalidator, setRevalidator]);

  useLayoutEffect(() => {
    setLocation(location);
  }, [location, setLocation]);

  useLayoutEffect(() => {
    setNavigationData(navigationData);
    setNavigationCount((count) => count + 1);
  }, [navigationData, setNavigationCount, setNavigationData]);

  useLayoutEffect(() => {
    setHydration();
  }, [setHydration]);

  return null;
}
