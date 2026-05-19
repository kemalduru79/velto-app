export type CareerLiveWorldEventTone = "system" | "crew" | "mentor" | "alert";

export type CareerLiveWorldEvent = {
  id: string;
  channel: string;
  text: string;
  tone: CareerLiveWorldEventTone;
  active: boolean;
};

type CareerLiveWorldEventInput = {
  language: "en" | "tr";
  missionTitle: string;
  professionTitle: string;
  mentorName: string;
  childTurnCount: number;
  isMentorTyping: boolean;
  latestChildMessage?: string;
};

function getProfessionEvent(language: "en" | "tr", professionTitle: string, childTurnCount: number): CareerLiveWorldEvent {
  const normalizedTitle = professionTitle.toLowerCase();

  if (normalizedTitle.includes("doctor") || normalizedTitle.includes("doktor")) {
    return language === "en"
      ? {
          id: "profession-doctor-event",
          channel: "MEDICAL BAY",
          text:
            childTurnCount > 1
              ? "Patient stability is changing. The care team is waiting for a calm priority call."
              : "Medical sensors are active. The first care priority will shape the room.",
          tone: childTurnCount > 1 ? "alert" : "system",
          active: true,
        }
      : {
          id: "profession-doctor-event",
          channel: "MEDİKAL ALAN",
          text:
            childTurnCount > 1
              ? "Hasta stabilitesi değişiyor. Bakım ekibi sakin bir öncelik kararı bekliyor."
              : "Medikal sensörler aktif. İlk bakım önceliği ortamı şekillendirecek.",
          tone: childTurnCount > 1 ? "alert" : "system",
          active: true,
        };
  }

  if (normalizedTitle.includes("cyber") || normalizedTitle.includes("detective") || normalizedTitle.includes("dedektif")) {
    return language === "en"
      ? {
          id: "profession-cyber-event",
          channel: "THREAT GRID",
          text:
            childTurnCount > 1
              ? "A hidden anomaly has surfaced in the network trace. The investigation is escalating."
              : "Encrypted signals are moving quietly through the grid. The first clue is waiting.",
          tone: childTurnCount > 1 ? "alert" : "system",
          active: true,
        }
      : {
          id: "profession-cyber-event",
          channel: "TEHDİT AĞI",
          text:
            childTurnCount > 1
              ? "Ağ izinde gizli bir anomali ortaya çıktı. Soruşturma derinleşiyor."
              : "Şifreli sinyaller ağ içinde sessizce ilerliyor. İlk ipucu bekliyor.",
          tone: childTurnCount > 1 ? "alert" : "system",
          active: true,
        };
  }

  if (normalizedTitle.includes("pilot")) {
    return language === "en"
      ? {
          id: "profession-pilot-event",
          channel: "FLIGHT DECK",
          text:
            childTurnCount > 1
              ? "Route stability is shifting. The cockpit is waiting for a confident navigation call."
              : "Flight systems are online. Your first cockpit command will set the route tone.",
          tone: childTurnCount > 1 ? "alert" : "system",
          active: true,
        }
      : {
          id: "profession-pilot-event",
          channel: "UÇUŞ KABİNİ",
          text:
            childTurnCount > 1
              ? "Rota stabilitesi değişiyor. Kokpit net bir navigasyon kararı bekliyor."
              : "Uçuş sistemleri aktif. İlk kokpit komutun rota hissini belirleyecek.",
          tone: childTurnCount > 1 ? "alert" : "system",
          active: true,
        };
  }

  if (normalizedTitle.includes("engineer") || normalizedTitle.includes("mühendis")) {
    return language === "en"
      ? {
          id: "profession-ai-event",
          channel: "MODEL OPS",
          text:
            childTurnCount > 1
              ? "Model confidence is fluctuating. The team needs a safe and ethical decision path."
              : "Training data is loading. Your first engineering instinct will guide the system.",
          tone: childTurnCount > 1 ? "alert" : "system",
          active: true,
        }
      : {
          id: "profession-ai-event",
          channel: "MODEL OPERASYONU",
          text:
            childTurnCount > 1
              ? "Model güven seviyesi dalgalanıyor. Ekibin güvenli ve etik bir karar yoluna ihtiyacı var."
              : "Eğitim verisi yükleniyor. İlk mühendislik sezgin sistemi yönlendirecek.",
          tone: childTurnCount > 1 ? "alert" : "system",
          active: true,
        };
  }

  return language === "en"
    ? {
        id: "profession-astronaut-event",
        channel: "LIFE SUPPORT",
        text:
          childTurnCount > 1
            ? "Oxygen fluctuation detected. The crew is waiting for a safe stabilization call."
            : "Station pressure is stable for now. The first command will shape the mission tempo.",
        tone: childTurnCount > 1 ? "alert" : "system",
        active: true,
      }
    : {
        id: "profession-astronaut-event",
        channel: "YAŞAM DESTEĞİ",
        text:
          childTurnCount > 1
            ? "Oksijen dalgalanması algılandı. Ekip güvenli bir stabilizasyon kararı bekliyor."
            : "İstasyon basıncı şimdilik stabil. İlk komut görev temposunu belirleyecek.",
        tone: childTurnCount > 1 ? "alert" : "system",
        active: true,
      };
}

function getCrewReaction(language: "en" | "tr", childTurnCount: number): CareerLiveWorldEvent {
  if (childTurnCount >= 3) {
    return language === "en"
      ? {
          id: "crew-reaction-advanced",
          channel: "CREW REACTION",
          text: "The crew is now looking for leadership, not just answers. Your tone is affecting their confidence.",
          tone: "crew",
          active: true,
        }
      : {
          id: "crew-reaction-advanced",
          channel: "EKİP TEPKİSİ",
          text: "Ekip artık sadece cevap değil liderlik arıyor. Tonun onların güvenini etkiliyor.",
          tone: "crew",
          active: true,
        };
  }

  if (childTurnCount >= 1) {
    return language === "en"
      ? {
          id: "crew-reaction-start",
          channel: "CREW REACTION",
          text: "First command received. The team is reacting to the child’s decision style.",
          tone: "crew",
          active: true,
        }
      : {
          id: "crew-reaction-start",
          channel: "EKİP TEPKİSİ",
          text: "İlk komut alındı. Ekip çocuğun karar tarzına tepki veriyor.",
          tone: "crew",
          active: true,
        };
  }

  return language === "en"
    ? {
        id: "crew-readiness",
        channel: "CREW STATUS",
        text: "Crew is waiting for the first command from the young professional.",
        tone: "crew",
        active: true,
      }
    : {
        id: "crew-readiness",
        channel: "EKİP DURUMU",
        text: "Ekip genç profesyonelin ilk komutunu bekliyor.",
        tone: "crew",
        active: true,
      };
}

export function createCareerLiveWorldEvents({
  language,
  missionTitle,
  professionTitle,
  mentorName,
  childTurnCount,
  isMentorTyping,
  latestChildMessage,
}: CareerLiveWorldEventInput): CareerLiveWorldEvent[] {
  const events: CareerLiveWorldEvent[] =
    language === "en"
      ? [
          {
            id: "mission-open",
            channel: "MISSION CONTROL",
            text: `${missionTitle} is live. ${professionTitle} channel is open.`,
            tone: "system",
            active: true,
          },
          {
            id: "mentor-watch",
            channel: "MENTOR",
            text: `${mentorName} is tracking reasoning, confidence and care signals.`,
            tone: "mentor",
            active: true,
          },
          getCrewReaction(language, childTurnCount),
          getProfessionEvent(language, professionTitle, childTurnCount),
          {
            id: "mentor-stream",
            channel: "LIVE SIGNAL",
            text: isMentorTyping
              ? `${mentorName} is transmitting a response...`
              : latestChildMessage
                ? "Latest response has been logged into the mission memory."
                : "Standing by for live mentor transmission.",
            tone: isMentorTyping ? "mentor" : "system",
            active: true,
          },
        ]
      : [
          {
            id: "mission-open",
            channel: "GÖREV KONTROL",
            text: `${missionTitle} canlı. ${professionTitle} kanalı açık.`,
            tone: "system",
            active: true,
          },
          {
            id: "mentor-watch",
            channel: "MENTOR",
            text: `${mentorName} düşünme, özgüven ve koruma sinyallerini izliyor.`,
            tone: "mentor",
            active: true,
          },
          getCrewReaction(language, childTurnCount),
          getProfessionEvent(language, professionTitle, childTurnCount),
          {
            id: "mentor-stream",
            channel: "CANLI SİNYAL",
            text: isMentorTyping
              ? `${mentorName} yanıt aktarıyor...`
              : latestChildMessage
                ? "Son yanıt görev anısına kaydedildi."
                : "Canlı mentor aktarımı için bekleniyor.",
            tone: isMentorTyping ? "mentor" : "system",
            active: true,
          },
        ];

  if (childTurnCount >= 1) {
    events.push(
      language === "en"
        ? {
            id: "ambient-shift",
            channel: "AMBIENT SHIFT",
            text: "Lighting, sound and system rhythm are adjusting to the first response.",
            tone: "system",
            active: true,
          }
        : {
            id: "ambient-shift",
            channel: "ATMOSFER DEĞİŞİMİ",
            text: "Işık, ses ve sistem ritmi ilk yanıta göre ayarlanıyor.",
            tone: "system",
            active: true,
          },
    );
  }

  if (childTurnCount >= 2) {
    events.push(
      language === "en"
        ? {
            id: "world-escalation",
            channel: "WORLD EVENT",
            text: "The mission environment is no longer passive. New pressure signals are adapting to the child’s choices.",
            tone: "alert",
            active: true,
          }
        : {
            id: "world-escalation",
            channel: "DÜNYA OLAYI",
            text: "Görev ortamı artık pasif değil. Yeni baskı sinyalleri çocuğun seçimlerine göre adapte oluyor.",
            tone: "alert",
            active: true,
          },
    );
  }

  if (childTurnCount >= 3) {
    events.push(
      language === "en"
        ? {
            id: "relationship-shift",
            channel: "MENTOR TRUST",
            text: `${mentorName} is beginning to understand how this child leads under pressure.`,
            tone: "mentor",
            active: true,
          }
        : {
            id: "relationship-shift",
            channel: "MENTOR GÜVENİ",
            text: `${mentorName} bu çocuğun baskı altında nasıl liderlik ettiğini anlamaya başlıyor.`,
            tone: "mentor",
            active: true,
          },
    );
  }

  if (childTurnCount >= 4) {
    events.push(
      language === "en"
        ? {
            id: "memory-lock",
            channel: "MISSION MEMORY",
            text: "Strong identity moments detected. The recap engine has enough material for a future mission memory.",
            tone: "mentor",
            active: true,
          }
        : {
            id: "memory-lock",
            channel: "GÖREV ANISI",
            text: "Güçlü kimlik anları algılandı. Recap motoru gelecek görev anısı için yeterli malzeme topladı.",
            tone: "mentor",
            active: true,
          },
    );
  }

  return events;
}
