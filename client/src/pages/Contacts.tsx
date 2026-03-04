import { useState } from "react";
import { Search, UserPlus, Phone, Video } from "lucide-react";

const CONTACTS = [
  { id: 1, name: "Алексей Иванов", status: "был(а) недавно", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop&crop=face", letter: "А" },
  { id: 2, name: "Алиса Смирнова", status: "в сети", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face", letter: "А" },
  { id: 3, name: "Борис Ельцин", status: "был(а) в 14:00", avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&h=150&fit=crop&crop=face", letter: "Б" },
  { id: 4, name: "Виктория Секрет", status: "в сети", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face", letter: "В" },
  { id: 5, name: "Григорий Лепс", status: "был(а) вчера", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face", letter: "Г" },
  { id: 6, name: "Дмитрий Нагиев", status: "в сети", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face", letter: "Д" },
  { id: 7, name: "Елена Ваенга", status: "печатает...", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face", letter: "Е" },
];

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredContacts = CONTACTS.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by letter
  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    if (!acc[contact.letter]) {
      acc[contact.letter] = [];
    }
    acc[contact.letter].push(contact);
    return acc;
  }, {} as Record<string, typeof CONTACTS>);

  return (
    <div className="flex h-full w-full justify-center bg-background">
      <div className="w-full h-full flex flex-col">
        
        {/* Header */}
        <div className="px-4 pt-6 pb-4 glass z-10 sticky top-0">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold tracking-tight">Контакты</h1>
            <button className="p-2 rounded-full text-primary bg-primary/10 hover:bg-primary/20 transition-colors">
              <UserPlus className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Поиск контактов" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-[15px] focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/70 outline-none"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto pb-24 sm:pb-28 px-2">
          {Object.keys(groupedContacts).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <p>Контакты не найдены</p>
            </div>
          ) : (
            Object.keys(groupedContacts).sort().map(letter => (
              <div key={letter} className="mb-4">
                <div className="px-4 py-1 text-sm font-bold text-muted-foreground bg-background sticky top-0 z-10">
                  {letter}
                </div>
                <div className="flex flex-col gap-1">
                  {groupedContacts[letter].map(contact => (
                    <div 
                      key={contact.id}
                      className="flex items-center justify-between p-2 hover:bg-secondary/50 rounded-2xl cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={contact.avatar} 
                          alt={contact.name} 
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div>
                          <h3 className="font-semibold text-[16px]">{contact.name}</h3>
                          <p className={`text-sm ${contact.status === 'в сети' ? 'text-primary' : 'text-muted-foreground'}`}>
                            {contact.status}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                        <button className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                          <Phone className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                          <Video className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}