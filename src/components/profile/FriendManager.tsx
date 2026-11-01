"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type FriendUser = { id: string; name?: string | null; username: string | null; image?: string | null };
type SearchUser = { id: string; username: string; relationship: string };
type FriendshipState = { friendshipId: string; user: FriendUser };
type FriendRequest = { id: string; user: FriendUser; createdAt: string };

function Person({ user, showIdentity = false }: { user: FriendUser; showIdentity?: boolean }) {
  return <>
    {showIdentity && (user.image ? <Image className="friend-avatar" src={user.image} width={44} height={44} alt="" unoptimized referrerPolicy="no-referrer" /> : <span className="friend-avatar friend-avatar-placeholder" aria-hidden="true">{user.name?.slice(0, 1).toUpperCase() || "R"}</span>)}
    <span className="friend-person-copy"><strong>{showIdentity ? user.name || (user.username ? `@${user.username}` : "REVOK member") : user.username ? `@${user.username}` : "REVOK member"}</strong>{showIdentity && <small>{user.username ? `@${user.username}` : "REVOK member"}</small>}</span>
  </>;
}

export default function FriendManager({ canEdit }: { canEdit: boolean }) {
  const [friends, setFriends] = useState<FriendshipState[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const timer = useRef<number | null>(null);

  async function loadFriends() {
    try {
      const response = await fetch("/api/account/friends", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setFriends(data.friends ?? []); setIncoming(data.incoming ?? []); setOutgoing(data.outgoing ?? []);
    } catch { setMessage("Your Friends section could not be loaded."); }
  }

  useEffect(() => {
    const initial = window.setTimeout(() => void loadFriends(), 0);
    return () => { window.clearTimeout(initial); if (timer.current) window.clearTimeout(timer.current); };
  }, []);

  function searchUsers(value: string) {
    setQuery(value); setMessage("");
    if (timer.current) window.clearTimeout(timer.current);
    if (value.trim().length < 2) { setResults([]); return; }
    timer.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/account/friends/search?q=${encodeURIComponent(value.trim())}`, { cache: "no-store" });
        const data = await response.json();
        if (response.ok) setResults(data.users ?? []);
        else setMessage(data.message ?? "Could not search users.");
      } catch { setMessage("Could not reach REVOK. Please try again."); }
      finally { setLoading(false); }
    }, 250);
  }

  async function sendRequest(person: SearchUser) {
    setBusyId(person.id); setMessage("");
    try {
      const response = await fetch("/api/account/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: person.username }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message ?? "Could not send the friend request."); return; }
      setResults((current) => current.map((entry) => entry.id === person.id ? { ...entry, relationship: "PENDING_SENT" } : entry));
      setMessage(data.message ?? "Friend request sent.");
      await loadFriends();
    } catch { setMessage("Could not reach REVOK. Please try again."); }
    finally { setBusyId(""); }
  }

  async function decide(id: string, action: "accept" | "reject" | "cancel") {
    setBusyId(id); setMessage("");
    try {
      const response = await fetch(`/api/account/friends/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message ?? "Could not update the friend request."); return; }
      await loadFriends();
    } catch { setMessage("Could not reach REVOK. Please try again."); }
    finally { setBusyId(""); }
  }

  async function removeFriend(friend: FriendshipState) {
    if (!window.confirm(`Remove ${friend.user.name ?? `@${friend.user.username ?? "this user"}`} from your friends? They will no longer receive notifications about your new reports.`)) return;
    setBusyId(friend.friendshipId); setMessage("");
    try {
      const response = await fetch(`/api/account/friends/${encodeURIComponent(friend.friendshipId)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message ?? "Could not remove this friend."); return; }
      await loadFriends();
    } catch { setMessage("Could not reach REVOK. Please try again."); }
    finally { setBusyId(""); }
  }

  return <section className="profile-card friend-manager" aria-labelledby="friends-heading">
    <div className="friend-manager-heading"><div><p className="eyebrow">Your REVOK connections</p><h2 id="friends-heading">Friends <span>{friends.length}</span></h2><p>Friends stay private. Only accepted friends can get alerts when you create a report.</p></div>{canEdit && <button className="button button-outline" type="button" aria-expanded={openSearch} onClick={() => { setOpenSearch((value) => !value); setMessage(""); }}>{openSearch ? "Close" : "Add Friend"}</button>}</div>
    {openSearch && canEdit && <div className="friend-search-panel"><label className="auth-field">Search by username<input value={query} maxLength={30} autoComplete="off" placeholder="Start typing a username" onChange={(event) => searchUsers(event.target.value)} /></label><p className="field-hint">Search results show usernames only. Names and profile photos appear after a request is accepted. Contact details stay private.</p>{loading && <p className="friend-feedback" role="status">Searchingâ€¦</p>}{results.length > 0 && <ul className="friend-list friend-search-results">{results.map((person) => <li className="friend-row" key={person.id}><Person user={person} /><span className="friend-row-action">{person.relationship === "NONE" ? <button className="button button-primary" type="button" disabled={busyId === person.id} onClick={() => void sendRequest(person)}>{busyId === person.id ? "Sendingâ€¦" : "Request Friend"}</button> : person.relationship === "PENDING_SENT" ? <span className="status-chip">Request sent</span> : person.relationship === "PENDING_RECEIVED" ? <span className="status-chip">Check requests below</span> : <span className="status-chip">{person.relationship.toLowerCase()}</span>}</span></li>)}</ul>}{query.trim().length >= 2 && !loading && results.length === 0 && <p className="friend-feedback">No matching available usernames.</p>}</div>}
    {incoming.length > 0 && <div className="friend-request-group"><h3>Received Requests <span>{incoming.length}</span></h3><ul className="friend-list">{incoming.map((request) => <li className="friend-row" key={request.id}><Person user={request.user} /><span className="friend-row-action"><button className="button button-primary" type="button" disabled={busyId === request.id} onClick={() => void decide(request.id, "accept")}>Accept</button><button className="button button-outline" type="button" disabled={busyId === request.id} onClick={() => void decide(request.id, "reject")}>Reject</button></span></li>)}</ul></div>}
    {outgoing.length > 0 && <div className="friend-request-group"><h3>Sent Requests</h3><ul className="friend-list">{outgoing.map((request) => <li className="friend-row" key={request.id}><Person user={request.user} /><span className="friend-row-action"><span className="status-chip">Pending</span><button className="button button-outline" type="button" disabled={busyId === request.id} onClick={() => void decide(request.id, "cancel")}>Cancel</button></span></li>)}</ul></div>}
    <h3>Accepted Friends <span>{friends.length}</span></h3>{friends.length > 0 ? <ul className="friend-list accepted-friends">{friends.map((friend) => <li className="friend-row" key={friend.friendshipId}><Person user={friend.user} showIdentity />{canEdit && <button className="button button-outline friend-remove" type="button" disabled={busyId === friend.friendshipId} onClick={() => void removeFriend(friend)}>{busyId === friend.friendshipId ? "Removingâ€¦" : "Remove Friend"}</button>}</li>)}</ul> : <p className="friend-empty">You do not have any accepted friends yet.</p>}
    {message && <p className="auth-message friend-feedback" role="status">{message}</p>}
  </section>;
}
