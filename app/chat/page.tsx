import ChatTab from "@/components/ChatTab";

export default function ChatPage() {
  return (
    <section className="mx-auto h-[72vh] min-h-[540px] max-w-4xl rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm">
      <ChatTab />
    </section>
  );
}