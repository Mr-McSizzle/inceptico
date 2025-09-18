
import Link from 'next/link';
import { ChatInterface } from "@/components/mentor/chat-interface";
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';

export default function MentorPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline text-foreground">EVE - Your AI Hive Mind Assistant</h1>
          <p className="text-muted-foreground">
            Engage with EVE via text for personalized business advice, or start a voice call.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/call/eve-hive-mind">
            <Phone className="mr-2 h-4 w-4" />
            Call EVE
          </Link>
        </Button>
      </header>
      <div className="flex-grow min-h-0">
        <ChatInterface />
      </div>
    </div>
  );
}
