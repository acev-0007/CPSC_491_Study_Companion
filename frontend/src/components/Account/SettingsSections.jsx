import { Link, useOutletContext } from "react-router-dom";
import { settingsItems } from "./settingsItems";

function Section({ title, subtitle, children }) {
  return <section className="settings-detail" aria-labelledby="settings-section-title">
    <Link className="settings-mobile-back" to="/account/menu">← All settings</Link>
    <header className="settings-detail-heading"><h1 id="settings-section-title">{title}</h1><p>{subtitle}</p></header>
    {children}
  </section>;
}
function Group({ title, description, children }) {
  return <div className="settings-group"><div className="settings-group-heading"><h2>{title}</h2>{description && <p>{description}</p>}</div><div className="settings-card">{children}</div></div>;
}
function Item({ title, description, value, future = false }) {
  return <div className="settings-row"><div className="settings-row-info"><h3>{title}</h3>{description && <p>{description}</p>}</div><span className={future ? "settings-coming-soon" : "settings-row-value"}>{future ? "Coming soon" : value}</span></div>;
}
export function SettingsMenu() {
  return <section className="settings-menu-content" aria-label="Settings categories"><h1>Settings</h1><p>Choose what you want to manage.</p><div className="settings-mobile-list">{settingsItems.map(item => <Link key={item.path} to={`/account/${item.path}`} className="settings-mobile-item"><span aria-hidden="true">{item.symbol}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span><span aria-hidden="true">›</span></Link>)}</div></section>;
}
export function ProfileSettings() {
  const { user, loading, error, retry } = useOutletContext();
  const name = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.name || "Your profile";
  const email = user?.email || "Not available";
  const initials = name === "Your profile" ? "?" : name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  return <Section title="Profile" subtitle="View your personal information and how it appears in AI Study Companion.">
    {error && <div className="settings-inline-error" role="alert"><span>Unable to load your profile.</span><button type="button" onClick={retry}>Try again</button></div>}
    <Group title="Profile picture" description="Add a personal touch to your account."><div className="settings-profile-hero"><div className="settings-avatar" aria-hidden="true">{initials}</div><div><h3>{loading ? "Loading profile…" : name}</h3><p>{loading ? "Checking account information" : email}</p><span className="settings-static-hint">Photo uploads will be available in a future update.</span></div></div></Group>
    <Group title="Personal information" description="Information associated with your signed-in account."><Item title="Display name" value={loading ? "Loading…" : error ? "Unavailable" : name}/><Item title="Email address" value={loading ? "Loading…" : error ? "Unavailable" : email}/></Group>
  </Section>;
}
export function SecuritySettings() {
  const { user, loading, error } = useOutletContext();
  return <Section title="Security" subtitle="Review your sign-in information and account protections.">
    <Group title="Sign-in details" description="Your account's current login information."><Item title="Email address" description="Used to sign in and receive account-related messages." value={loading ? "Loading…" : error ? "Unavailable" : user?.email || "Not available"}/><Item title="Password management" description="Changing your password securely will be available later." future /></Group>
    <Group title="Account access" description="Keep your account recoverable and protected."><Item title="Account recovery" description="Password recovery and reset management." future/><Item title="Email verification" description="Email confirmation is handled by your sign-in flow; account-status management is not yet available here." future/></Group>
  </Section>;
}
export function PreferenceSettings() {
  return <Section title="Preferences" subtitle="Personalize the way AI Study Companion looks and feels.">
    <Group title="Appearance" description="Choose how the interface is displayed."><Item title="Theme" description="System, light, and dark themes are planned. Theme changes are not enabled on this screen yet." future /></Group>
    <Group title="Interface" description="Additional personalization options may be added as the application grows."><Item title="Language" description="The interface currently uses English. Additional languages are not yet supported." value="English" /></Group>
  </Section>;
}
export function PrivacySettings() {
  return <Section title="Data & Privacy" subtitle="Understand your study information and account data controls.">
    <Group title="Your study data" description="Content you create and save while using study tools."><Item title="Saved materials" description="Documents, flashcards, summaries, and assignments are managed within their respective study tools." value="Managed in study tools"/><Item title="Account data controls" description="Additional account-wide privacy and data controls are planned." future /></Group>
    <Group title="Account lifecycle" description="Destructive account actions require additional safeguards."><Item title="Delete account" description="Account deletion and associated data cleanup are not available in this sprint." future /></Group>
  </Section>;
}
