export type AdapterName = "core" | "next" | "react" | "react-router" | "remix";
export type AdapterSupport = "supported" | "candidate";

export interface AdapterCapabilities {
  name: AdapterName;
  support: AdapterSupport;
  stateCapture: boolean;
  destinationCorrelation: boolean;
  commitSignals: readonly ("transition" | "location" | "promise")[];
  realBrowserCoverage: boolean;
}

const ADAPTERS: Record<AdapterName, AdapterCapabilities> = {
  core: {
    name: "core", support: "supported", stateCapture: true, destinationCorrelation: true,
    commitSignals: ["promise"], realBrowserCoverage: true,
  },
  react: {
    name: "react", support: "supported", stateCapture: true, destinationCorrelation: true,
    commitSignals: ["transition", "location", "promise"], realBrowserCoverage: true,
  },
  next: {
    name: "next", support: "supported", stateCapture: true, destinationCorrelation: true,
    commitSignals: ["transition", "location", "promise"], realBrowserCoverage: true,
  },
  "react-router": {
    name: "react-router", support: "candidate", stateCapture: true, destinationCorrelation: false,
    commitSignals: ["location"], realBrowserCoverage: false,
  },
  remix: {
    name: "remix", support: "candidate", stateCapture: true, destinationCorrelation: false,
    commitSignals: ["location"], realBrowserCoverage: false,
  },
};

export function getAdapterCapabilities(name: AdapterName): AdapterCapabilities {
  return ADAPTERS[name];
}

export function listAdapterCapabilities(): AdapterCapabilities[] {
  return Object.values(ADAPTERS);
}

