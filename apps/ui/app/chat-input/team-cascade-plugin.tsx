"use client";

import {
  $createTagNode,
  useTagRenderer,
  useTriggerSlot,
  useTypeaheadKeyboard,
} from "@coss/ui/components/chat-input";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Member {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  members: Member[];
}

const TEAMS: Team[] = [
  {
    id: "t1",
    members: [
      { id: "a1", name: "Alice" },
      { id: "a2", name: "Amir" },
      { id: "a3", name: "Anna" },
    ],
    name: "Team Alpha",
  },
  {
    id: "t2",
    members: [
      { id: "b1", name: "Bob" },
      { id: "b2", name: "Bella" },
    ],
    name: "Team Beta",
  },
];

function searchTeams(query: string): Promise<Team[]> {
  const q = query.toLowerCase();
  return new Promise((resolve) => {
    setTimeout(
      () => resolve(TEAMS.filter((t) => t.name.toLowerCase().includes(q))),
      150,
    );
  });
}

// A 'custom' escape-hatch plugin (spec §4.11): the engine yields the menu +
// keyboard, and this plugin draws its own Raycast-style cascade. Level 0 (teams)
// is text-driven via slot.query + useQuery; drilling into a team opens a panel
// whose member filter lives in local state. Selecting a leaf calls slot.select.
export function TeamCascadePlugin() {
  const slot = useTriggerSlot({ char: "#", id: "team", kind: "custom" });

  const { data: teams, isLoading } = useQuery({
    enabled: slot.active,
    queryFn: () => searchTeams(slot.query),
    queryKey: ["teams", slot.query],
  });

  const [panel, setPanel] = useState<{ team: Team; query: string } | null>(
    null,
  );
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);

  const teamList = teams ?? [];
  const members = panel
    ? panel.team.members.filter((m) =>
        m.name.toLowerCase().includes(panel.query.toLowerCase()),
      )
    : [];
  const listLength = panel ? members.length : teamList.length;

  useTagRenderer("team-member", (d) => (
    <span
      data-testid="tag-pill"
      style={{ background: "#ffe8d6", borderRadius: 4, padding: "0 4px" }}
    >
      #{String(d.name)}
    </span>
  ));

  // Reset when the trigger closes.
  useEffect(() => {
    if (!slot.active) {
      setPanel(null);
      setActive(0);
    }
  }, [slot.active]);

  // Position the panel at the caret.
  useLayoutEffect(() => {
    if (!slot.active) {
      setRect(null);
      return;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setRect({ left: r.left, top: r.bottom });
    }
  }, [slot.active]);

  const drill = (t: Team) => {
    setPanel({ query: "", team: t });
    setActive(0);
  };
  const pickMember = (m: Member) =>
    slot.select({
      toNode: () => $createTagNode("team-member", { id: m.id, name: m.name }),
    });

  const choose = () => {
    if (panel) {
      const m = members[active];
      if (m) pickMember(m);
    } else {
      const t = teamList[active];
      if (t) drill(t);
    }
  };

  useTypeaheadKeyboard({
    enabled: slot.active,
    onArrowDown: () => {
      if (listLength === 0) return false;
      setActive((a) => (a + 1) % listLength);
      return true;
    },
    onArrowLeft: () => {
      if (!panel) return false;
      setPanel(null);
      setActive(0);
      return true;
    },
    onArrowRight: () => {
      if (panel) return false;
      const t = teamList[active];
      if (!t) return false;
      drill(t);
      return true;
    },
    onArrowUp: () => {
      if (listLength === 0) return false;
      setActive((a) => (a - 1 + listLength) % listLength);
      return true;
    },
    onBackspace: () => {
      if (!panel) return false;
      if (panel.query)
        setPanel({ query: panel.query.slice(0, -1), team: panel.team });
      else setPanel(null);
      setActive(0);
      return true;
    },
    onChar: (k) => {
      if (!panel) return false;
      setPanel({ query: panel.query + k, team: panel.team });
      setActive(0);
      return true;
    },
    onEnter: () => {
      if (listLength === 0) return false;
      choose();
      return true;
    },
    onEscape: () => {
      if (!slot.active) return false;
      slot.close();
      return true;
    },
    onTab: () => {
      if (listLength === 0) return false;
      choose();
      return true;
    },
  });

  if (!slot.active || !rect) return null;

  return createPortal(
    <ul
      className="min-w-52 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground text-sm shadow-md"
      data-testid="mention-menu"
      style={{
        left: rect.left,
        position: "fixed",
        top: rect.top + 4,
        zIndex: 50,
      }}
    >
      {panel && (
        <li
          className="px-2 py-1 text-muted-foreground text-xs"
          data-testid="mention-breadcrumb"
        >
          ‹ #{panel.team.name} {panel.query}
        </li>
      )}
      {panel ? (
        members.length === 0 ? (
          <li className="px-2 py-1.5 text-muted-foreground">No results</li>
        ) : (
          members.map((m, i) => (
            <li
              className={`flex cursor-pointer rounded-sm px-2 py-1.5 ${
                i === active ? "bg-accent text-accent-foreground" : ""
              }`}
              data-active={i === active}
              data-testid="mention-item"
              key={m.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pickMember(m);
              }}
              onMouseEnter={() => setActive(i)}
            >
              @{m.name}
            </li>
          ))
        )
      ) : isLoading && teamList.length === 0 ? (
        <li className="px-2 py-1.5 text-muted-foreground">Loading…</li>
      ) : teamList.length === 0 ? (
        <li className="px-2 py-1.5 text-muted-foreground">No results</li>
      ) : (
        teamList.map((t, i) => (
          <li
            className={`flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 ${
              i === active ? "bg-accent text-accent-foreground" : ""
            }`}
            data-active={i === active}
            data-testid="mention-item"
            key={t.id}
            onMouseDown={(e) => {
              e.preventDefault();
              drill(t);
            }}
            onMouseEnter={() => setActive(i)}
          >
            <span>#{t.name}</span>
            <span className="text-muted-foreground">›</span>
          </li>
        ))
      )}
    </ul>,
    document.body,
  );
}
