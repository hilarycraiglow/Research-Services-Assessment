// Role definitions: each role asks the same three questions about every inventory item,
// phrased in that audience's own working language.
const ROLES = {
  library: {
    id: "library",
    label: "Library",
    subtitle: "Library leadership & service managers",
    color: "#0B2545",
    questions: [
      { key: "offer", text: (s) => `Does your library currently offer ${s}?`,
        options: [
          { value: 2, label: "Yes" },
          { value: 0, label: "No" }
        ] },
      { key: "isolate", text: (s) => `Can you isolate the costs of ${s} from your other library costs?`,
        options: [
          { value: 2, label: "Yes" },
          { value: 1, label: "Somewhat" },
          { value: 0, label: "No" }
        ] },
      { key: "demonstrate", text: (s) => `Can you show what ${s} costs on a per-project or per-researcher basis?`,
        options: [
          { value: 2, label: "Yes" },
          { value: 1, label: "Somewhat" },
          { value: 0, label: "No" }
        ] }
    ]
  },
  admin: {
    id: "admin",
    label: "Research Administration",
    subtitle: "Sponsored programs & research administrators",
    color: "#52733E",
    questions: [
      { key: "value", text: (s) => `Is ${s} valuable to your institution's research strategy?`,
        options: [
          { value: 2, label: "Yes" },
          { value: 1, label: "Not sure" },
          { value: 0, label: "No" }
        ] },
      { key: "compliance", text: (s) => `Does ${s} help satisfy grant compliance requirements?`,
        options: [
          { value: 2, label: "Yes" },
          { value: 1, label: "Somewhat" },
          { value: 0, label: "No" }
        ] },
      { key: "chargeable", text: (s) => `If there were an allocable, documented per project cost for this service, would you be open to direct charging?`,
        options: [
          { value: 2, label: "Yes" },
          { value: 1, label: "Maybe" },
          { value: 0, label: "No" }
        ] }
    ]
  },
  costing: {
    id: "costing",
    label: "University Costing",
    subtitle: "Institutional costing & cost accounting teams",
    color: "#1F87A6",
    questions: [
      { key: "costcenter", text: (s) => `Do you have an existing cost center, or similar mechanism, that could charge for ${s}?`,
        options: [
          { value: 2, label: "Yes" },
          { value: 0, label: "No" }
        ] },
      { key: "idc", text: (s) => `Are you including ${s} in your IDC Library Cost Pool?`,
        options: [
          { value: 2, label: "Yes" },
          { value: 0, label: "No" }
        ] },
      { key: "direct", text: () => `Would you consider moving this service to direct charging?`,
        options: [
          { value: 2, label: "Yes" },
          { value: 1, label: "Maybe" },
          { value: 0, label: "No" }
        ] }
    ]
  }
};

const ROLE_ORDER = ["library", "admin", "costing"];
