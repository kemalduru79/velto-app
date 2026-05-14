export type LocalizedText = { tr: string; en: string };
export type CareerProfessionKey =
  | "astronaut"
  | "doctor"
  | "pilot"
  | "ai_engineer"
  | "cyber_detective";

export type CareerProfessionConfig = {
  key: CareerProfessionKey;
  icon: string;
  accent: string;
  title: Record<"tr" | "en", string>;
  subtitle: Record<"tr" | "en", string>;
  mission: Record<"tr" | "en", string>;
  mentorTone: Record<"tr" | "en", string>;
  decisionExamples: Record<"tr" | "en", string[]>;
  reportOutputs: Record<"tr" | "en", string[]>;
};

export const CAREER_LAB_PROFESSIONS: CareerProfessionConfig[] = [
  {
    key: "astronaut",
    icon: "🚀",
    accent: "cyan",
    title: { tr: "Astronot", en: "Astronaut" },
    subtitle: { tr: "Uzay görevi ve kriz yönetimi", en: "Space mission and crisis management" },
    mission: {
      tr: "Çocuk bir uzay görevinde oksijen, rota, ekip iletişimi ve istasyon güvenliği kararları verir.",
      en: "The child makes decisions about oxygen, route, crew communication, and station safety during a space mission.",
    },
    mentorTone: { tr: "Sakin, görev odaklı ve cesaretlendirici görev komutanı", en: "Calm, mission-focused, encouraging flight commander" },
    decisionExamples: {
      tr: ["Önce oksijen sistemini mi kontrol edersin?", "Üs ile bağlantı mı kurarsın?", "Ekibi güvenli bölgeye mi yönlendirirsin?"],
      en: ["Do you check oxygen systems first?", "Do you contact mission control?", "Do you guide the crew to a safe zone?"],
    },
    reportOutputs: {
      tr: ["Görev raporu", "Karar haritası", "Astronot kariyer kartı"],
      en: ["Mission report", "Decision map", "Astronaut career card"],
    },
  },
  {
    key: "doctor",
    icon: "🩺",
    accent: "emerald",
    title: { tr: "Doktor", en: "Doctor" },
    subtitle: { tr: "Belirti analizi ve güvenli önceliklendirme", en: "Symptom analysis and safe prioritization" },
    mission: {
      tr: "Çocuk belirtileri değerlendirir, güvenli önceliklendirme yapar ve doğru uzman desteğini ne zaman çağıracağını öğrenir.",
      en: "The child evaluates symptoms, prioritizes safely, and learns when to ask for expert support.",
    },
    mentorTone: { tr: "Şefkatli, güvenli ve öğretici klinik mentor", en: "Kind, safe, educational clinical mentor" },
    decisionExamples: {
      tr: ["Hangi belirtiyi önce incelersin?", "Acil destek çağırır mısın?", "Hastaya hangi soruyu sorarsın?"],
      en: ["Which symptom do you check first?", "Do you call emergency support?", "Which question do you ask the patient?"],
    },
    reportOutputs: {
      tr: ["Deneyim raporu", "Problem çözme özeti", "Doktor kariyer kartı"],
      en: ["Experience report", "Problem-solving summary", "Doctor career card"],
    },
  },
  {
    key: "pilot",
    icon: "✈️",
    accent: "sky",
    title: { tr: "Pilot", en: "Pilot" },
    subtitle: { tr: "Kontrol paneli, rota ve acil durum kararları", en: "Control panel, route, and emergency decisions" },
    mission: {
      tr: "Çocuk hava durumu, rota, kule iletişimi ve güvenli iniş kararlarını yönetir.",
      en: "The child manages weather, route, tower communication, and safe landing decisions.",
    },
    mentorTone: { tr: "Net, disiplinli ve güvenlik odaklı kaptan pilot", en: "Clear, disciplined, safety-first captain pilot" },
    decisionExamples: {
      tr: ["Rotayı değiştirir misin?", "Kuleye öncelikli mesaj gönderir misin?", "Yakıt ve irtifayı nasıl dengelersin?"],
      en: ["Do you change route?", "Do you send a priority tower message?", "How do you balance fuel and altitude?"],
    },
    reportOutputs: {
      tr: ["Uçuş özeti", "Karar haritası", "Pilot kariyer kartı"],
      en: ["Flight summary", "Decision map", "Pilot career card"],
    },
  },
  {
    key: "ai_engineer",
    icon: "🤖",
    accent: "violet",
    title: { tr: "AI Engineer", en: "AI Engineer" },
    subtitle: { tr: "Model eğitimi, veri ve etik kararlar", en: "Model training, data, and ethics decisions" },
    mission: {
      tr: "Çocuk bir AI asistanını güvenli şekilde tasarlar, veri kalitesi ve etik sınırlar hakkında karar verir.",
      en: "The child designs an AI assistant safely and makes decisions about data quality and ethical boundaries.",
    },
    mentorTone: { tr: "Merak uyandıran, etik odaklı ve teknik rehber", en: "Curious, ethics-focused, technical guide" },
    decisionExamples: {
      tr: ["Hangi veriyi kullanırsın?", "AI yanlış cevap verirse ne yaparsın?", "Güvenlik sınırını nasıl belirlersin?"],
      en: ["Which data do you use?", "What do you do if the AI answers incorrectly?", "How do you set a safety boundary?"],
    },
    reportOutputs: {
      tr: ["AI proje özeti", "Etik karar kartı", "AI Engineer kariyer kartı"],
      en: ["AI project summary", "Ethics decision card", "AI Engineer career card"],
    },
  },
  {
    key: "cyber_detective",
    icon: "🕵️‍♂️",
    accent: "amber",
    title: { tr: "Cyber Detective", en: "Cyber Detective" },
    subtitle: { tr: "Dijital ipucu analizi ve güvenli araştırma", en: "Digital clue analysis and safe investigation" },
    mission: {
      tr: "Çocuk dijital ipuçlarını analiz eder, güvenli araştırma adımları atar ve veri koruma bakış açısı kazanır.",
      en: "The child analyzes digital clues, follows safe investigation steps, and learns a data-protection mindset.",
    },
    mentorTone: { tr: "Dikkatli, analitik ve güvenlik bilinci yüksek mentor", en: "Careful, analytical, security-aware mentor" },
    decisionExamples: {
      tr: ["Logları mı incelersin?", "Şüpheli bağlantıyı izole eder misin?", "Hangi ipucu daha güvenilir?"],
      en: ["Do you inspect the logs?", "Do you isolate the suspicious link?", "Which clue is more reliable?"],
    },
    reportOutputs: {
      tr: ["Vaka raporu", "İpucu haritası", "Cyber Detective kariyer kartı"],
      en: ["Case report", "Clue map", "Cyber Detective career card"],
    },
  },
];

export const CAREER_LAB_COPY: Record<"tr" | "en", {
  badge: string;
  title: string;
  description: string;
  selectionTitle: string;
  decisionModelTitle: string;
  decisionModelDescription: string;
  microDecisionLabel: string;
  majorDecisionLabel: string;
  adaptiveReactionLabel: string;
  comingNextTitle: string;
  comingNextItems: string[];
  selectedProfession: string;
  mentorTone: string;
  sampleDecisions: string;
  outputs: string;
}> = {
  tr: {
    badge: "Career Lab Shell",
    title: "Interactive Profession Simulation",
    description: "Çocuk bir meslek seçer, güvenli bir görev simülasyonunda kararlar verir ve deneyim sonunda AI destekli rapor alır. Bu sprint yalnızca ürün iskeletini kurar; mission engine bir sonraki sprintte eklenecek.",
    selectionTitle: "Pilot meslek seçimi",
    decisionModelTitle: "Karar modeli",
    decisionModelDescription: "Career Lab açık dünya değil; kontrollü ama zengin karar hissi veren micro + major decision yapısıyla ilerleyecek.",
    microDecisionLabel: "10–15 micro decision",
    majorDecisionLabel: "3–4 major decision",
    adaptiveReactionLabel: "Adaptive AI reaction",
    comingNextTitle: "Bir sonraki sprint",
    comingNextItems: ["Guided Mission Engine", "Decision state", "Mission intro generation", "Experience report skeleton"],
    selectedProfession: "Seçili meslek",
    mentorTone: "Mentor tonu",
    sampleDecisions: "Örnek kararlar",
    outputs: "Planlanan çıktılar",
  },
  en: {
    badge: "Career Lab Shell",
    title: "Interactive Profession Simulation",
    description: "The child chooses a profession, makes decisions inside a safe mission simulation, and receives an AI-supported report at the end. This sprint only creates the product shell; the mission engine comes next.",
    selectionTitle: "Pilot profession selection",
    decisionModelTitle: "Decision model",
    decisionModelDescription: "Career Lab is not an open-world game; it will use controlled but rich micro + major decisions to create a strong role-play feeling.",
    microDecisionLabel: "10–15 micro decisions",
    majorDecisionLabel: "3–4 major decisions",
    adaptiveReactionLabel: "Adaptive AI reaction",
    comingNextTitle: "Next sprint",
    comingNextItems: ["Guided Mission Engine", "Decision state", "Mission intro generation", "Experience report skeleton"],
    selectedProfession: "Selected profession",
    mentorTone: "Mentor tone",
    sampleDecisions: "Sample decisions",
    outputs: "Planned outputs",
  },
};

export function getCareerProfession(key?: string | null) {
  return CAREER_LAB_PROFESSIONS.find((profession) => profession.key === key) || CAREER_LAB_PROFESSIONS[0];
}

export type CareerDecisionType = "micro" | "major";

export type CareerDecisionOption = {
  id: string;
  label: LocalizedText;
  effect: LocalizedText;
  traitImpact: {
    logic?: number;
    empathy?: number;
    courage?: number;
    teamwork?: number;
    creativity?: number;
    focus?: number;
  };
};

export type CareerDecisionPoint = {
  id: string;
  type: CareerDecisionType;
  title: LocalizedText;
  scenario: LocalizedText;
  options: CareerDecisionOption[];
};

export type CareerMissionTemplate = {
  professionKey: CareerProfessionKey;
  title: LocalizedText;
  briefing: LocalizedText;
  objective: LocalizedText;
  decisionPoints: CareerDecisionPoint[];
};

export const CAREER_LAB_MISSIONS: Record<CareerProfessionKey, CareerMissionTemplate> = {
  astronaut: {
    professionKey: "astronaut",
    title: {
      en: "Lunar Station Rescue",
      tr: "Ay Üssü Kurtarma Görevi",
    },
    briefing: {
      en: "A research station near the Moon has reported a sudden oxygen system warning. Your mission is to stabilize the team and choose the safest recovery path.",
      tr: "Ay yakınındaki araştırma üssünden ani bir oksijen sistemi uyarısı geldi. Görevin ekibi sakin tutmak ve en güvenli çözüm yolunu seçmek.",
    },
    objective: {
      en: "Protect the crew, diagnose the oxygen issue, and decide whether the mission should continue or return to base.",
      tr: "Mürettebatı koru, oksijen sorununu analiz et ve görevin devam edip etmeyeceğine karar ver.",
    },
    decisionPoints: [
      {
        id: "astro_micro_oxygen",
        type: "micro",
        title: { en: "First System Check", tr: "İlk Sistem Kontrolü" },
        scenario: {
          en: "The oxygen alarm is blinking, but the communication panel is also unstable. What do you check first?",
          tr: "Oksijen alarmı yanıp sönüyor, ancak iletişim paneli de kararsız. Önce neyi kontrol edersin?",
        },
        options: [
          {
            id: "oxygen_sensor",
            label: { en: "Check the oxygen sensor logs", tr: "Oksijen sensör kayıtlarını kontrol et" },
            effect: { en: "You prioritize diagnosis before action.", tr: "Aksiyon öncesi doğru teşhise öncelik verirsin." },
            traitImpact: { logic: 2, focus: 1 },
          },
          {
            id: "crew_status",
            label: { en: "Ask the crew for health status", tr: "Mürettebatın sağlık durumunu sor" },
            effect: { en: "You prioritize people before systems.", tr: "Sistemlerden önce insan güvenliğine odaklanırsın." },
            traitImpact: { empathy: 2, teamwork: 1 },
          },
          {
            id: "manual_backup",
            label: { en: "Activate backup oxygen manually", tr: "Yedek oksijeni manuel başlat" },
            effect: { en: "You take fast protective action under pressure.", tr: "Baskı altında hızlı koruma aksiyonu alırsın." },
            traitImpact: { courage: 2, focus: 1 },
          },
        ],
      },
      {
        id: "astro_major_route",
        type: "major",
        title: { en: "Continue or Return?", tr: "Devam mı, Dönüş mü?" },
        scenario: {
          en: "The station can be stabilized, but the risk is not fully gone. Do you continue the mission or return to base?",
          tr: "Üs stabilize edilebilir, ancak risk tamamen ortadan kalkmadı. Göreve devam mı edersin, üsse dönüş mü yaparsın?",
        },
        options: [
          {
            id: "continue_cautiously",
            label: { en: "Continue with reduced mission scope", tr: "Görev kapsamını azaltarak devam et" },
            effect: { en: "You balance ambition with safety.", tr: "Hedef ile güvenlik arasında denge kurarsın." },
            traitImpact: { logic: 1, courage: 1, focus: 1 },
          },
          {
            id: "return_base",
            label: { en: "Return to base with the crew", tr: "Mürettebatla birlikte üsse dön" },
            effect: { en: "You choose safety and team protection.", tr: "Güvenlik ve ekip korumasını seçersin." },
            traitImpact: { empathy: 1, teamwork: 2 },
          },
          {
            id: "request_remote_support",
            label: { en: "Request mission control support first", tr: "Önce görev kontrol desteği iste" },
            effect: { en: "You use expert collaboration before final action.", tr: "Son karar öncesi uzman desteği alırsın." },
            traitImpact: { teamwork: 2, logic: 1 },
          },
        ],
      },
      {
        id: "astro_micro_comm",
        type: "micro",
        title: { en: "Communication Check", tr: "İletişim Kontrolü" },
        scenario: {
          en: "Mission Control sends a delayed signal. Do you wait, act with current data, or ask the crew to verify manually?",
          tr: "Görev Kontrol gecikmeli sinyal gönderiyor. Bekler misin, mevcut veriyle hareket mi edersin, yoksa mürettebattan manuel doğrulama mı istersin?",
        },
        options: [
          {
            id: "wait_signal",
            label: { en: "Wait for a clearer signal", tr: "Daha net sinyal bekle" },
            effect: { en: "You prefer certainty before action.", tr: "Aksiyondan önce kesinliği tercih edersin." },
            traitImpact: { focus: 2, logic: 1 },
          },
          {
            id: "act_current_data",
            label: { en: "Act using current data", tr: "Mevcut veriyle hareket et" },
            effect: { en: "You make decisions under uncertainty.", tr: "Belirsizlik altında karar verirsin." },
            traitImpact: { courage: 2, logic: 1 },
          },
          {
            id: "manual_verify",
            label: { en: "Ask crew for manual verification", tr: "Mürettebattan manuel doğrulama iste" },
            effect: { en: "You use teamwork to reduce risk.", tr: "Riski azaltmak için takım çalışmasını kullanırsın." },
            traitImpact: { teamwork: 2, focus: 1 },
          },
        ],
      },
      {
        id: "astro_major_resource",
        type: "major",
        title: { en: "Resource Allocation", tr: "Kaynak Dağılımı" },
        scenario: {
          en: "Power is limited. You can protect life support, communications, or navigation first.",
          tr: "Enerji sınırlı. Önce yaşam desteğini, iletişimi veya navigasyonu koruyabilirsin.",
        },
        options: [
          {
            id: "protect_life_support",
            label: { en: "Protect life support", tr: "Yaşam desteğini koru" },
            effect: { en: "You put crew safety first.", tr: "Mürettebat güvenliğini ilk sıraya koyarsın." },
            traitImpact: { empathy: 1, focus: 2 },
          },
          {
            id: "protect_comms",
            label: { en: "Protect communications", tr: "İletişimi koru" },
            effect: { en: "You value coordinated decision-making.", tr: "Koordineli karar vermeye önem verirsin." },
            traitImpact: { teamwork: 2, logic: 1 },
          },
          {
            id: "protect_navigation",
            label: { en: "Protect navigation", tr: "Navigasyonu koru" },
            effect: { en: "You secure the path before the next move.", tr: "Bir sonraki hamleden önce rotayı güvenceye alırsın." },
            traitImpact: { logic: 2, focus: 1 },
          },
        ],
      },
    ],
  },
  doctor: {
    professionKey: "doctor",
    title: { en: "Emergency Room Triage", tr: "Acil Servis Önceliklendirme" },
    briefing: {
      en: "Three patients arrive at the same time. Your role is to ask the right questions, prioritize safely, and coordinate care.",
      tr: "Üç hasta aynı anda gelir. Rolün doğru soruları sormak, güvenli önceliklendirme yapmak ve bakımı koordine etmek.",
    },
    objective: {
      en: "Identify the highest-risk patient and choose the safest first action.",
      tr: "En riskli hastayı belirle ve en güvenli ilk aksiyonu seç.",
    },
    decisionPoints: [
      {
        id: "doctor_micro_triage",
        type: "micro",
        title: { en: "First Question", tr: "İlk Soru" },
        scenario: {
          en: "You have limited time. What is the first thing you ask or check?",
          tr: "Zaman sınırlı. İlk olarak ne sorar veya neyi kontrol edersin?",
        },
        options: [
          {
            id: "check_breathing",
            label: { en: "Check breathing and consciousness", tr: "Solunum ve bilinç durumunu kontrol et" },
            effect: { en: "You focus on urgent life signs.", tr: "Acil yaşam bulgularına odaklanırsın." },
            traitImpact: { logic: 2, focus: 2 },
          },
          {
            id: "ask_symptoms",
            label: { en: "Ask each patient about symptoms", tr: "Her hastaya semptomlarını sor" },
            effect: { en: "You collect information before deciding.", tr: "Karar vermeden önce bilgi toplarsın." },
            traitImpact: { empathy: 1, logic: 1 },
          },
          {
            id: "call_nurse",
            label: { en: "Call a nurse for support", tr: "Destek için hemşire çağır" },
            effect: { en: "You coordinate help early.", tr: "Yardımı erken koordine edersin." },
            traitImpact: { teamwork: 2, focus: 1 },
          },
        ],
      },
      {
        id: "doctor_major_priority",
        type: "major",
        title: { en: "Who First?", tr: "Önce Kim?" },
        scenario: {
          en: "One patient is scared, one has pain, and one is quiet but pale. Who receives your first full attention?",
          tr: "Bir hasta korkmuş, biri ağrı çekiyor, biri ise sessiz ama solgun. İlk tam ilgiyi kime verirsin?",
        },
        options: [
          {
            id: "quiet_pale",
            label: { en: "The quiet but pale patient", tr: "Sessiz ama solgun hasta" },
            effect: { en: "You notice hidden risk, not only loud symptoms.", tr: "Sadece görünür belirtileri değil, gizli riski fark edersin." },
            traitImpact: { logic: 2, focus: 2 },
          },
          {
            id: "pain_patient",
            label: { en: "The patient in pain", tr: "Ağrı çeken hasta" },
            effect: { en: "You respond to visible distress quickly.", tr: "Görünür sıkıntıya hızlı yanıt verirsin." },
            traitImpact: { empathy: 2 },
          },
          {
            id: "scared_patient",
            label: { en: "The scared patient first", tr: "Önce korkmuş hasta" },
            effect: { en: "You calm emotions and build trust.", tr: "Duyguları yatıştırır ve güven kurarsın." },
            traitImpact: { empathy: 2, teamwork: 1 },
          },
        ],
      },
      {
        id: "doctor_micro_team",
        type: "micro",
        title: { en: "Team Coordination", tr: "Ekip Koordinasyonu" },
        scenario: {
          en: "A nurse asks whether to prepare equipment or calm the waiting family first. What do you prioritize?",
          tr: "Hemşire önce ekipman mı hazırlansın yoksa bekleyen aile mi sakinleştirilsin diye soruyor. Neyi önceliklendirirsin?",
        },
        options: [
          {
            id: "prepare_equipment",
            label: { en: "Prepare critical equipment", tr: "Kritik ekipmanı hazırla" },
            effect: { en: "You prepare the system for fast care.", tr: "Sistemi hızlı bakım için hazırlarsın." },
            traitImpact: { focus: 2, logic: 1 },
          },
          {
            id: "calm_family",
            label: { en: "Calm the family first", tr: "Önce aileyi sakinleştir" },
            effect: { en: "You protect trust and emotional stability.", tr: "Güveni ve duygusal dengeyi korursun." },
            traitImpact: { empathy: 2, teamwork: 1 },
          },
          {
            id: "split_team",
            label: { en: "Split tasks across the team", tr: "Görevleri ekip içinde bölüştür" },
            effect: { en: "You coordinate parallel action.", tr: "Eş zamanlı aksiyonu koordine edersin." },
            traitImpact: { teamwork: 2, focus: 1 },
          },
        ],
      },
      {
        id: "doctor_major_uncertainty",
        type: "major",
        title: { en: "Uncertain Diagnosis", tr: "Belirsiz Teşhis" },
        scenario: {
          en: "The symptoms are unclear. Do you run more tests, consult a senior doctor, or start the safest general treatment?",
          tr: "Belirtiler net değil. Daha fazla test mi yaparsın, kıdemli doktora mı danışırsın, yoksa en güvenli genel tedaviye mi başlarsın?",
        },
        options: [
          {
            id: "more_tests",
            label: { en: "Run more tests", tr: "Daha fazla test yap" },
            effect: { en: "You reduce uncertainty with evidence.", tr: "Belirsizliği kanıtla azaltırsın." },
            traitImpact: { logic: 2, focus: 1 },
          },
          {
            id: "consult_senior",
            label: { en: "Consult a senior doctor", tr: "Kıdemli doktora danış" },
            effect: { en: "You use expert collaboration.", tr: "Uzman iş birliğinden faydalanırsın." },
            traitImpact: { teamwork: 2, logic: 1 },
          },
          {
            id: "safe_treatment",
            label: { en: "Start the safest general treatment", tr: "En güvenli genel tedaviye başla" },
            effect: { en: "You act carefully while protecting the patient.", tr: "Hastayı korurken dikkatli aksiyon alırsın." },
            traitImpact: { empathy: 1, courage: 1, focus: 1 },
          },
        ],
      },
    ],
  },
  pilot: {
    professionKey: "pilot",
    title: { en: "Storm Landing Decision", tr: "Fırtınada İniş Kararı" },
    briefing: {
      en: "Your aircraft is approaching a storm zone. You must evaluate weather, fuel, passenger safety, and tower instructions.",
      tr: "Uçağın fırtına bölgesine yaklaşıyor. Hava durumu, yakıt, yolcu güvenliği ve kule talimatlarını değerlendirmen gerekiyor.",
    },
    objective: {
      en: "Choose a safe route and manage pressure without rushing.",
      tr: "Güvenli rotayı seç ve baskı altında acele etmeden yönet.",
    },
    decisionPoints: [
      {
        id: "pilot_micro_weather",
        type: "micro",
        title: { en: "First Cockpit Action", tr: "İlk Kokpit Aksiyonu" },
        scenario: {
          en: "The weather radar shows heavy clouds ahead. What is your first action?",
          tr: "Hava radarı ileride yoğun bulut gösteriyor. İlk aksiyonun nedir?",
        },
        options: [
          {
            id: "check_radar",
            label: { en: "Check radar and wind data", tr: "Radar ve rüzgâr verisini kontrol et" },
            effect: { en: "You use data before making a move.", tr: "Hamle yapmadan önce veriyi kullanırsın." },
            traitImpact: { logic: 2, focus: 1 },
          },
          {
            id: "contact_tower",
            label: { en: "Contact the control tower", tr: "Kontrol kulesiyle iletişime geç" },
            effect: { en: "You coordinate with the wider system.", tr: "Daha geniş sistemle koordinasyon kurarsın." },
            traitImpact: { teamwork: 2 },
          },
          {
            id: "calm_passengers",
            label: { en: "Ask cabin crew to reassure passengers", tr: "Kabin ekibinden yolcuları rahatlatmasını iste" },
            effect: { en: "You protect the emotional safety of passengers.", tr: "Yolcuların duygusal güvenliğini de korursun." },
            traitImpact: { empathy: 1, teamwork: 1 },
          },
        ],
      },
      {
        id: "pilot_major_route",
        type: "major",
        title: { en: "Route Choice", tr: "Rota Seçimi" },
        scenario: {
          en: "You can land now with turbulence, circle and wait, or divert to another airport.",
          tr: "Türbülansla şimdi inebilir, bekleme turu atabilir veya başka havalimanına yönelebilirsin.",
        },
        options: [
          {
            id: "circle_wait",
            label: { en: "Circle and wait for safer conditions", tr: "Daha güvenli koşullar için bekleme turu at" },
            effect: { en: "You choose patience over pressure.", tr: "Baskı yerine sabrı seçersin." },
            traitImpact: { focus: 2, logic: 1 },
          },
          {
            id: "divert_airport",
            label: { en: "Divert to another airport", tr: "Başka havalimanına yönel" },
            effect: { en: "You make a protective strategic choice.", tr: "Koruyucu ve stratejik bir karar verirsin." },
            traitImpact: { courage: 1, logic: 2 },
          },
          {
            id: "land_now",
            label: { en: "Attempt landing now", tr: "Şimdi inişi dene" },
            effect: { en: "You act decisively but accept higher pressure.", tr: "Kararlı davranır ancak daha yüksek baskı kabul edersin." },
            traitImpact: { courage: 2, focus: 1 },
          },
        ],
      },
      {
        id: "pilot_micro_fuel",
        type: "micro",
        title: { en: "Fuel Check", tr: "Yakıt Kontrolü" },
        scenario: {
          en: "Fuel is enough, but not unlimited. Do you save fuel, prioritize comfort, or prepare for diversion?",
          tr: "Yakıt yeterli ama sınırsız değil. Yakıt mı tasarruf edersin, konforu mu önceliklendirirsin, yoksa yön değiştirmeye mi hazırlanırsın?",
        },
        options: [
          {
            id: "save_fuel",
            label: { en: "Optimize fuel use", tr: "Yakıt kullanımını optimize et" },
            effect: { en: "You manage resources carefully.", tr: "Kaynakları dikkatli yönetirsin." },
            traitImpact: { logic: 2, focus: 1 },
          },
          {
            id: "comfort_route",
            label: { en: "Choose the smoother path", tr: "Daha yumuşak rotayı seç" },
            effect: { en: "You consider passenger comfort.", tr: "Yolcu konforunu dikkate alırsın." },
            traitImpact: { empathy: 1, teamwork: 1 },
          },
          {
            id: "diversion_ready",
            label: { en: "Prepare diversion plan", tr: "Yön değiştirme planı hazırla" },
            effect: { en: "You prepare backup options early.", tr: "Yedek seçenekleri erken hazırlarsın." },
            traitImpact: { focus: 2, logic: 1 },
          },
        ],
      },
      {
        id: "pilot_major_crew",
        type: "major",
        title: { en: "Crew Briefing", tr: "Ekip Brifingi" },
        scenario: {
          en: "Cabin crew asks what to tell passengers. Do you share full details, keep it calm and brief, or wait for more data?",
          tr: "Kabin ekibi yolculara ne söyleyeceğini soruyor. Tüm detayları mı paylaşırsın, kısa ve sakin mi tutarsın, yoksa daha fazla veri mi beklersin?",
        },
        options: [
          {
            id: "full_details",
            label: { en: "Share full details", tr: "Tüm detayları paylaş" },
            effect: { en: "You value transparency.", tr: "Şeffaflığa önem verirsin." },
            traitImpact: { courage: 1, teamwork: 1 },
          },
          {
            id: "calm_brief",
            label: { en: "Keep it calm and brief", tr: "Kısa ve sakin tut" },
            effect: { en: "You protect confidence under pressure.", tr: "Baskı altında güven duygusunu korursun." },
            traitImpact: { empathy: 2, focus: 1 },
          },
          {
            id: "wait_more_data",
            label: { en: "Wait for more data", tr: "Daha fazla veri bekle" },
            effect: { en: "You avoid premature communication.", tr: "Erken iletişim riskinden kaçınırsın." },
            traitImpact: { logic: 2 },
          },
        ],
      },
    ],
  },
  ai_engineer: {
    professionKey: "ai_engineer",
    title: { en: "Train the Helper Robot", tr: "Yardımcı Robotu Eğit" },
    briefing: {
      en: "A school helper robot is making confusing suggestions. You must improve its behavior safely and fairly.",
      tr: "Bir okul yardımcı robotu kafa karıştırıcı öneriler yapıyor. Davranışını güvenli ve adil şekilde iyileştirmelisin.",
    },
    objective: {
      en: "Find the issue, improve the instructions, and test the robot responsibly.",
      tr: "Sorunu bul, yönergeleri iyileştir ve robotu sorumlu şekilde test et.",
    },
    decisionPoints: [
      {
        id: "ai_micro_debug",
        type: "micro",
        title: { en: "Debug First", tr: "Önce Hata Ayıkla" },
        scenario: {
          en: "The robot gives different answers to similar students. What do you inspect first?",
          tr: "Robot benzer öğrencilere farklı cevaplar veriyor. Önce neyi incelersin?",
        },
        options: [
          {
            id: "training_examples",
            label: { en: "Review training examples", tr: "Eğitim örneklerini incele" },
            effect: { en: "You check whether the robot learned from balanced examples.", tr: "Robotun dengeli örneklerden öğrenip öğrenmediğini kontrol edersin." },
            traitImpact: { logic: 2, focus: 1 },
          },
          {
            id: "user_feedback",
            label: { en: "Read user feedback", tr: "Kullanıcı geri bildirimlerini oku" },
            effect: { en: "You listen to real user experience.", tr: "Gerçek kullanıcı deneyimini dinlersin." },
            traitImpact: { empathy: 1, logic: 1 },
          },
          {
            id: "safety_rules",
            label: { en: "Check safety rules", tr: "Güvenlik kurallarını kontrol et" },
            effect: { en: "You prioritize safe boundaries.", tr: "Güvenli sınırları önceliklendirirsin." },
            traitImpact: { focus: 2, logic: 1 },
          },
        ],
      },
      {
        id: "ai_major_release",
        type: "major",
        title: { en: "Release Decision", tr: "Yayın Kararı" },
        scenario: {
          en: "The robot is improved but not perfect. Do you release, test more, or limit the feature?",
          tr: "Robot iyileşti ama mükemmel değil. Yayına alır, daha çok test eder veya özelliği sınırlar mısın?",
        },
        options: [
          {
            id: "test_more",
            label: { en: "Test with more scenarios", tr: "Daha fazla senaryoyla test et" },
            effect: { en: "You prefer reliable systems over speed.", tr: "Hız yerine güvenilir sistemi seçersin." },
            traitImpact: { focus: 2, logic: 1 },
          },
          {
            id: "limited_release",
            label: { en: "Release with clear limits", tr: "Açık sınırlarla yayına al" },
            effect: { en: "You balance innovation and safety.", tr: "Yenilik ile güvenliği dengelersin." },
            traitImpact: { creativity: 1, logic: 1, focus: 1 },
          },
          {
            id: "full_release",
            label: { en: "Release now and monitor", tr: "Şimdi yayına al ve izle" },
            effect: { en: "You move fast but accept monitoring responsibility.", tr: "Hızlı ilerler ama izleme sorumluluğunu alırsın." },
            traitImpact: { courage: 1, creativity: 1 },
          },
        ],
      },
      {
        id: "ai_micro_prompt",
        type: "micro",
        title: { en: "Instruction Design", tr: "Yönerge Tasarımı" },
        scenario: {
          en: "The robot misunderstands vague instructions. Do you rewrite the prompt, add examples, or restrict risky answers?",
          tr: "Robot belirsiz yönergeleri yanlış anlıyor. Prompt’u mu yeniden yazarsın, örnek mi eklersin, yoksa riskli cevapları mı sınırlarsın?",
        },
        options: [
          {
            id: "rewrite_prompt",
            label: { en: "Rewrite the prompt", tr: "Prompt’u yeniden yaz" },
            effect: { en: "You improve the system instruction layer.", tr: "Sistem yönerge katmanını iyileştirirsin." },
            traitImpact: { creativity: 1, logic: 2 },
          },
          {
            id: "add_examples",
            label: { en: "Add better examples", tr: "Daha iyi örnekler ekle" },
            effect: { en: "You teach through concrete patterns.", tr: "Somut örüntülerle öğretirsin." },
            traitImpact: { logic: 1, creativity: 1, focus: 1 },
          },
          {
            id: "restrict_answers",
            label: { en: "Restrict risky answers", tr: "Riskli cevapları sınırla" },
            effect: { en: "You strengthen safety boundaries.", tr: "Güvenlik sınırlarını güçlendirirsin." },
            traitImpact: { focus: 2, logic: 1 },
          },
        ],
      },
      {
        id: "ai_major_ethics",
        type: "major",
        title: { en: "Fairness Check", tr: "Adalet Kontrolü" },
        scenario: {
          en: "The robot may help some students more than others. Do you pause release, redesign the test, or add human review?",
          tr: "Robot bazı öğrencilere diğerlerinden daha fazla yardımcı olabilir. Yayını durdurur, testi yeniden tasarlar veya insan kontrolü mü eklersin?",
        },
        options: [
          {
            id: "pause_release",
            label: { en: "Pause release", tr: "Yayını durdur" },
            effect: { en: "You put fairness before speed.", tr: "Hızdan önce adaleti koyarsın." },
            traitImpact: { empathy: 2, focus: 1 },
          },
          {
            id: "redesign_test",
            label: { en: "Redesign the test set", tr: "Test setini yeniden tasarla" },
            effect: { en: "You improve the evidence base.", tr: "Kanıt temelini güçlendirirsin." },
            traitImpact: { logic: 2, creativity: 1 },
          },
          {
            id: "human_review",
            label: { en: "Add human review", tr: "İnsan kontrolü ekle" },
            effect: { en: "You combine automation with responsibility.", tr: "Otomasyonu sorumlulukla birleştirirsin." },
            traitImpact: { teamwork: 2, empathy: 1 },
          },
        ],
      },
    ],
  },
  cyber_detective: {
    professionKey: "cyber_detective",
    title: { en: "The Missing Data Mystery", tr: "Kayıp Veri Gizemi" },
    briefing: {
      en: "A school project folder disappeared. Your mission is to investigate digital clues and protect privacy.",
      tr: "Bir okul proje klasörü kayboldu. Görevin dijital ipuçlarını incelemek ve gizliliği korumak.",
    },
    objective: {
      en: "Find the safest explanation without blaming anyone too early.",
      tr: "Kimseyi erken suçlamadan en güvenli açıklamayı bul.",
    },
    decisionPoints: [
      {
        id: "cyber_micro_logs",
        type: "micro",
        title: { en: "First Clue", tr: "İlk İpucu" },
        scenario: {
          en: "You see login logs, file history, and a strange download. What do you inspect first?",
          tr: "Giriş kayıtları, dosya geçmişi ve garip bir indirme görüyorsun. Önce neyi incelersin?",
        },
        options: [
          {
            id: "login_logs",
            label: { en: "Check login logs", tr: "Giriş kayıtlarını kontrol et" },
            effect: { en: "You look for access patterns.", tr: "Erişim desenlerini incelersin." },
            traitImpact: { logic: 2, focus: 1 },
          },
          {
            id: "file_history",
            label: { en: "Review file history", tr: "Dosya geçmişini incele" },
            effect: { en: "You follow the evidence trail.", tr: "Kanıt izini takip edersin." },
            traitImpact: { logic: 1, focus: 2 },
          },
          {
            id: "ask_team",
            label: { en: "Ask the team what happened", tr: "Ekibe ne olduğunu sor" },
            effect: { en: "You include people before conclusions.", tr: "Sonuca varmadan insanları dahil edersin." },
            traitImpact: { empathy: 1, teamwork: 1 },
          },
        ],
      },
      {
        id: "cyber_major_action",
        type: "major",
        title: { en: "Protect or Pursue?", tr: "Koru mu, Takip mi?" },
        scenario: {
          en: "You found suspicious activity. Do you lock the folder, trace the source, or notify the teacher first?",
          tr: "Şüpheli aktivite buldun. Klasörü kilitler, kaynağı takip eder veya önce öğretmene haber verir misin?",
        },
        options: [
          {
            id: "lock_folder",
            label: { en: "Lock the folder first", tr: "Önce klasörü kilitle" },
            effect: { en: "You protect data before investigating deeper.", tr: "Derin incelemeden önce veriyi korursun." },
            traitImpact: { focus: 2, logic: 1 },
          },
          {
            id: "trace_source",
            label: { en: "Trace the source", tr: "Kaynağı takip et" },
            effect: { en: "You investigate actively.", tr: "Aktif şekilde araştırırsın." },
            traitImpact: { courage: 1, logic: 2 },
          },
          {
            id: "notify_teacher",
            label: { en: "Notify the teacher", tr: "Öğretmene haber ver" },
            effect: { en: "You escalate responsibly.", tr: "Sorumlu şekilde üst kişiye iletirsin." },
            traitImpact: { teamwork: 2, empathy: 1 },
          },
        ],
      },
      {
        id: "cyber_micro_privacy",
        type: "micro",
        title: { en: "Privacy Boundary", tr: "Gizlilik Sınırı" },
        scenario: {
          en: "You can access more data, but it may include private messages. What do you do?",
          tr: "Daha fazla veriye erişebilirsin ama özel mesajlar içerebilir. Ne yaparsın?",
        },
        options: [
          {
            id: "avoid_private",
            label: { en: "Avoid private messages", tr: "Özel mesajlardan kaçın" },
            effect: { en: "You respect privacy boundaries.", tr: "Gizlilik sınırlarına saygı gösterirsin." },
            traitImpact: { empathy: 2, focus: 1 },
          },
          {
            id: "ask_permission",
            label: { en: "Ask permission first", tr: "Önce izin iste" },
            effect: { en: "You investigate responsibly.", tr: "Sorumlu şekilde araştırırsın." },
            traitImpact: { teamwork: 1, empathy: 1, logic: 1 },
          },
          {
            id: "metadata_only",
            label: { en: "Use metadata only", tr: "Sadece metadata kullan" },
            effect: { en: "You reduce risk while keeping evidence.", tr: "Kanıtı korurken riski azaltırsın." },
            traitImpact: { logic: 2, focus: 1 },
          },
        ],
      },
      {
        id: "cyber_major_response",
        type: "major",
        title: { en: "Incident Response", tr: "Olay Müdahalesi" },
        scenario: {
          en: "You found a likely cause. Do you restore files, write an incident note, or improve prevention first?",
          tr: "Olası nedeni buldun. Dosyaları mı geri yüklersin, olay notu mu yazarsın, yoksa önce önlemeyi mi iyileştirirsin?",
        },
        options: [
          {
            id: "restore_files",
            label: { en: "Restore the files", tr: "Dosyaları geri yükle" },
            effect: { en: "You solve the immediate problem.", tr: "Acil problemi çözersin." },
            traitImpact: { focus: 2, courage: 1 },
          },
          {
            id: "incident_note",
            label: { en: "Write an incident note", tr: "Olay notu yaz" },
            effect: { en: "You document evidence clearly.", tr: "Kanıtları açık şekilde belgelersin." },
            traitImpact: { logic: 1, focus: 2 },
          },
          {
            id: "improve_prevention",
            label: { en: "Improve prevention rules", tr: "Önleme kurallarını iyileştir" },
            effect: { en: "You prevent the issue from repeating.", tr: "Sorunun tekrarlanmasını önlersin." },
            traitImpact: { logic: 2, creativity: 1 },
          },
        ],
      },
    ],
  },
};

export function getCareerMission(professionKey: CareerProfessionKey): CareerMissionTemplate {
  return CAREER_LAB_MISSIONS[professionKey];
}

export type CareerTraitProfile = {
  logic: number;
  empathy: number;
  courage: number;
  teamwork: number;
  creativity: number;
  focus: number;
};

export const CAREER_TRAIT_LABELS: Record<keyof CareerTraitProfile, LocalizedText> = {
  logic: { en: "Logic", tr: "Mantık" },
  empathy: { en: "Empathy", tr: "Empati" },
  courage: { en: "Courage", tr: "Cesaret" },
  teamwork: { en: "Teamwork", tr: "Takım Çalışması" },
  creativity: { en: "Creativity", tr: "Yaratıcılık" },
  focus: { en: "Focus", tr: "Odak" },
};

export function calculateCareerTraitProfile(
  mission: CareerMissionTemplate,
  answers: Record<string, string>
): CareerTraitProfile {
  const profile: CareerTraitProfile = {
    logic: 0,
    empathy: 0,
    courage: 0,
    teamwork: 0,
    creativity: 0,
    focus: 0,
  };

  mission.decisionPoints.forEach((decision) => {
    const selectedOptionId = answers[decision.id];
    const selectedOption = decision.options.find((option) => option.id === selectedOptionId);

    if (!selectedOption) return;

    Object.entries(selectedOption.traitImpact).forEach(([trait, value]) => {
      if (typeof value !== "number") return;
      if (!(trait in profile)) return;

      profile[trait as keyof CareerTraitProfile] += value;
    });
  });

  return profile;
}

export function getCareerTraitSummary(
  profile: CareerTraitProfile,
  language: "tr" | "en"
): {
  title: string;
  description: string;
  strongestTraits: Array<keyof CareerTraitProfile>;
} {
  const entries = Object.entries(profile) as Array<[keyof CareerTraitProfile, number]>;
  const strongestTraits = entries
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([trait]) => trait);

  if (strongestTraits.length === 0) {
    return {
      title: language === "en" ? "Simulation profile is waiting" : "Simülasyon profili bekliyor",
      description:
        language === "en"
          ? "Choose options in the mission to reveal early decision signals."
          : "İlk karar sinyallerini görmek için görevdeki seçenekleri işaretle.",
      strongestTraits,
    };
  }

  const strongestLabel = CAREER_TRAIT_LABELS[strongestTraits[0]][language];

  return {
    title:
      language === "en"
        ? `${strongestLabel} is leading`
        : `${strongestLabel} öne çıkıyor`,
    description:
      language === "en"
        ? "This is not a career test. It is a lightweight reflection of how the child approached this simulated mission."
        : "Bu bir kariyer testi değildir. Çocuğun bu simülasyon görevine nasıl yaklaştığını gösteren hafif bir yansımadır.",
    strongestTraits,
  };
}



export function getCareerAdaptiveFeedback(
  profile: CareerTraitProfile,
  answeredDecisionCount: number,
  totalDecisionCount: number,
  language: "tr" | "en"
): {
  title: string;
  message: string;
  nextTip: string;
} {
  if (answeredDecisionCount === 0) {
    return {
      title: language === "en" ? "Your mentor is observing" : "Mentorun gözlem yapıyor",
      message:
        language === "en"
          ? "Start by choosing how you would act in the mission. The feedback will adapt to your decisions."
          : "Görevde nasıl hareket edeceğini seçerek başla. Geri bildirim kararlarına göre şekillenecek.",
      nextTip:
        language === "en"
          ? "Choose the option that feels safest and smartest to you."
          : "Sana en güvenli ve en akıllıca gelen seçeneği işaretle.",
    };
  }

  const entries = Object.entries(profile) as Array<[keyof CareerTraitProfile, number]>;
  const [topTrait, topValue] = entries.sort((a, b) => b[1] - a[1])[0];
  const topTraitLabel = CAREER_TRAIT_LABELS[topTrait][language];

  if (answeredDecisionCount < totalDecisionCount) {
    return {
      title:
        language === "en"
          ? `${topTraitLabel} is shaping your mission style`
          : `${topTraitLabel} görev tarzını şekillendiriyor`,
      message:
        language === "en"
          ? "Your early choices are starting to reveal how you handle pressure, information, and teamwork in this simulated profession."
          : "İlk seçimlerin, bu simüle edilmiş meslekte baskı, bilgi ve ekip çalışmasını nasıl yönettiğini göstermeye başladı.",
      nextTip:
        language === "en"
          ? "Continue with the next decision and see whether your profile becomes more balanced or more specialized."
          : "Sonraki kararla devam et; profilinin daha dengeli mi yoksa daha uzmanlaşmış mı ilerlediğini gör.",
    };
  }

  if (topValue >= 4) {
    return {
      title:
        language === "en"
          ? `${topTraitLabel} is your strongest signal`
          : `En güçlü sinyalin: ${topTraitLabel}`,
      message:
        language === "en"
          ? "In this mission, your decisions showed a clear pattern. This is not a career test, but it helps explain how you approached the simulation."
          : "Bu görevde kararların belirgin bir desen gösterdi. Bu bir kariyer testi değil; yalnızca simülasyona nasıl yaklaştığını açıklamaya yardımcı olur.",
      nextTip:
        language === "en"
          ? "In the next version, this pattern can feed an experience report and a cinematic recap."
          : "Sonraki versiyonda bu desen deneyim raporuna ve sinematik özete aktarılabilir.",
    };
  }

  return {
    title: language === "en" ? "Balanced decision style" : "Dengeli karar tarzı",
    message:
      language === "en"
        ? "Your decisions were distributed across different strengths rather than concentrating on a single trait."
        : "Kararların tek bir özellikte yoğunlaşmak yerine farklı güçlü yönlere dağıldı.",
    nextTip:
      language === "en"
        ? "This balanced style can be useful in complex missions with both people and systems."
        : "Bu dengeli tarz, hem insanları hem de sistemleri içeren karmaşık görevlerde faydalı olabilir.",
  };
}


export function getCareerExperienceReportPreview(
  profession: ReturnType<typeof getCareerProfession>,
  mission: CareerMissionTemplate,
  profile: CareerTraitProfile,
  answers: Record<string, string>,
  language: "tr" | "en"
): {
  title: string;
  subtitle: string;
  summary: string;
  decisionHighlights: string[];
  strengths: string[];
  nextSteps: string[];
  disclaimer: string;
} {
  const answeredDecisions = mission.decisionPoints
    .map((decision) => {
      const selectedOptionId = answers[decision.id];
      const selectedOption = decision.options.find((option) => option.id === selectedOptionId);

      if (!selectedOption) return null;

      return {
        decision,
        selectedOption,
      };
    })
    .filter(Boolean) as Array<{
      decision: CareerDecisionPoint;
      selectedOption: CareerDecisionOption;
    }>;

  const entries = Object.entries(profile) as Array<[keyof CareerTraitProfile, number]>;
  const strongestTraits = entries
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([trait]) => trait);

  const professionTitle = profession.title[language] ?? profession.title.tr;
  const missionTitle = mission.title[language] ?? mission.title.tr;

  const decisionHighlights = answeredDecisions.map(({ decision, selectedOption }) => {
    const decisionTitle = decision.title[language] ?? decision.title.tr;
    const optionLabel = selectedOption.label[language] ?? selectedOption.label.tr;
    const optionEffect = selectedOption.effect[language] ?? selectedOption.effect.tr;

    return language === "en"
      ? `${decisionTitle}: ${optionLabel}. ${optionEffect}`
      : `${decisionTitle}: ${optionLabel}. ${optionEffect}`;
  });

  const strengths =
    strongestTraits.length > 0
      ? strongestTraits.map((trait) => {
          const label = CAREER_TRAIT_LABELS[trait][language];
          return language === "en"
            ? `${label} appeared as a visible decision signal.`
            : `${label} görünür bir karar sinyali olarak öne çıktı.`;
        })
      : [
          language === "en"
            ? "No strong signal yet. Complete the guided decisions to reveal the profile."
            : "Henüz güçlü sinyal oluşmadı. Profili görmek için yönlendirmeli kararları tamamla.",
        ];

  return {
    title:
      language === "en"
        ? `${professionTitle} Experience Report`
        : `${professionTitle} Deneyim Raporu`,
    subtitle:
      language === "en"
        ? `Mission: ${missionTitle}`
        : `Görev: ${missionTitle}`,
    summary:
      language === "en"
        ? "This preview summarizes how the child approached the simulated profession mission. It reflects choices made inside the experience, not a real career assessment."
        : "Bu önizleme, çocuğun simüle edilmiş meslek görevine nasıl yaklaştığını özetler. Gerçek bir kariyer değerlendirmesi değil, yalnızca deneyim içindeki seçimleri yansıtır.",
    decisionHighlights,
    strengths,
    nextSteps:
      language === "en"
        ? [
            "Add more decision points to make the simulation richer.",
            "Generate a final experience report after the mission is completed.",
            "Later, convert this report into a short cinematic recap.",
          ]
        : [
            "Simülasyonu zenginleştirmek için daha fazla karar noktası ekle.",
            "Görev tamamlandığında nihai deneyim raporu oluştur.",
            "İleride bu raporu kısa bir sinematik özete dönüştür.",
          ],
    disclaimer:
      language === "en"
        ? "This is not a career test or psychological assessment."
        : "Bu bir kariyer testi veya psikolojik değerlendirme değildir.",
  };
}


export function getCareerFinalReport(
  profession: ReturnType<typeof getCareerProfession>,
  mission: CareerMissionTemplate,
  profile: CareerTraitProfile,
  answers: Record<string, string>,
  language: "tr" | "en"
): {
  title: string;
  sections: Array<{
    title: string;
    body: string;
    items?: string[];
  }>;
} {
  const preview = getCareerExperienceReportPreview(profession, mission, profile, answers, language);
  const entries = Object.entries(profile) as Array<[keyof CareerTraitProfile, number]>;
  const topTraits = entries
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([trait, value]) => `${CAREER_TRAIT_LABELS[trait][language]}: ${value}`);

  const decisionItems =
    preview.decisionHighlights.length > 0
      ? preview.decisionHighlights
      : [
          language === "en"
            ? "No guided decision has been selected yet."
            : "Henüz yönlendirmeli karar seçilmedi.",
        ];

  return {
    title: preview.title,
    sections: [
      {
        title: language === "en" ? "Mission Summary" : "Görev Özeti",
        body: preview.summary,
      },
      {
        title: language === "en" ? "Decision Highlights" : "Karar Özetleri",
        body:
          language === "en"
            ? "These are the key choices made during the simulation."
            : "Bunlar simülasyon sırasında verilen temel kararları özetler.",
        items: decisionItems,
      },
      {
        title: language === "en" ? "Observed Strength Signals" : "Gözlemlenen Güçlü Sinyaller",
        body:
          language === "en"
            ? "The following signals appeared during this simulated mission."
            : "Bu simülasyon görevi sırasında aşağıdaki sinyaller öne çıktı.",
        items:
          topTraits.length > 0
            ? topTraits
            : [
                language === "en"
                  ? "No dominant signal yet."
                  : "Henüz baskın sinyal oluşmadı.",
              ],
      },
      {
        title: language === "en" ? "Important Note" : "Önemli Not",
        body: preview.disclaimer,
      },
    ],
  };
}


export function formatCareerFinalReportMarkdown(
  report: ReturnType<typeof getCareerFinalReport>,
  language: "tr" | "en"
): string {
  const lines: string[] = [];

  lines.push(`# ${report.title}`);
  lines.push("");
  lines.push(
    language === "en"
      ? "_Generated by VELTO AI Career Lab — Interactive Profession Simulation_"
      : "_VELTO AI Career Lab — Interactive Profession Simulation tarafından oluşturuldu_"
  );
  lines.push("");

  report.sections.forEach((section) => {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(section.body);
    lines.push("");

    if (section.items?.length) {
      section.items.forEach((item) => {
        lines.push(`- ${item}`);
      });
      lines.push("");
    }
  });

  lines.push("---");
  lines.push(
    language === "en"
      ? "Note: This output is not a career test or psychological assessment."
      : "Not: Bu çıktı bir kariyer testi veya psikolojik değerlendirme değildir."
  );

  return lines.join("\n");
}


export function getCareerPilotReadinessNotes(language: "tr" | "en"): {
  title: string;
  items: string[];
} {
  return language === "en"
    ? {
        title: "Pilot use notes",
        items: [
          "This flow is ready for guided internal demos.",
          "The current version is a local interactive simulation, not a full AI-generated mission yet.",
          "Recommended test style: choose one profession, complete all decisions, review the report, and download it.",
          "Next production step: AI-enhanced narrative report and larger decision sets.",
        ],
      }
    : {
        title: "Pilot kullanım notları",
        items: [
          "Bu akış yönlendirmeli iç demo kullanımı için hazırdır.",
          "Mevcut versiyon yerel interaktif simülasyondur; henüz tam AI üretimli görev akışı değildir.",
          "Önerilen test şekli: bir meslek seç, tüm kararları tamamla, raporu incele ve indir.",
          "Sonraki ürünleşme adımı: AI destekli anlatı raporu ve genişletilmiş karar setleri.",
        ],
      };
}


export function getCareerCinematicRecapBlueprint(
  profession: ReturnType<typeof getCareerProfession>,
  mission: CareerMissionTemplate,
  profile: CareerTraitProfile,
  answers: Record<string, string>,
  language: "tr" | "en"
): {
  title: string;
  description: string;
  scenes: Array<{
    title: string;
    visualDirection: string;
    narration: string;
  }>;
  productionNote: string;
} {
  const professionTitle = profession.title[language] ?? profession.title.tr;
  const missionTitle = mission.title[language] ?? mission.title.tr;

  const answeredDecisions = mission.decisionPoints
    .map((decision) => {
      const selectedOptionId = answers[decision.id];
      const selectedOption = decision.options.find((option) => option.id === selectedOptionId);

      if (!selectedOption) return null;

      return {
        decisionTitle: decision.title[language] ?? decision.title.tr,
        optionLabel: selectedOption.label[language] ?? selectedOption.label.tr,
        optionEffect: selectedOption.effect[language] ?? selectedOption.effect.tr,
      };
    })
    .filter(Boolean) as Array<{
      decisionTitle: string;
      optionLabel: string;
      optionEffect: string;
    }>;

  const entries = Object.entries(profile) as Array<[keyof CareerTraitProfile, number]>;
  const strongestTrait = entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "focus";
  const strongestTraitLabel = CAREER_TRAIT_LABELS[strongestTrait][language];

  const firstDecision = answeredDecisions[0];
  const finalDecision = answeredDecisions[answeredDecisions.length - 1];

  return {
    title:
      language === "en"
        ? `${professionTitle} Cinematic Recap Blueprint`
        : `${professionTitle} Sinematik Özet Planı`,
    description:
      language === "en"
        ? `A short recap structure for the ${missionTitle} simulation. This is a planning output only; it does not generate video yet.`
        : `${missionTitle} simülasyonu için kısa özet yapısı. Bu yalnızca planlama çıktısıdır; henüz video üretmez.`,
    scenes: [
      {
        title: language === "en" ? "Opening Mission Moment" : "Açılış Görev Anı",
        visualDirection:
          language === "en"
            ? `Show the child entering the role of ${professionTitle} in a premium cinematic AI experience setting.`
            : `Çocuğun ${professionTitle} rolüne premium sinematik AI deneyim ortamında girdiği anı göster.`,
        narration:
          language === "en"
            ? `Today, the mission begins: ${missionTitle}.`
            : `Bugün görev başlıyor: ${missionTitle}.`,
      },
      {
        title: language === "en" ? "First Important Choice" : "İlk Önemli Seçim",
        visualDirection:
          language === "en"
            ? "Show a focused decision moment with clear visual stakes and child-friendly tension."
            : "Net görsel riskler ve çocuk dostu gerilim içeren odaklı bir karar anı göster.",
        narration: firstDecision
          ? `${firstDecision.decisionTitle}: ${firstDecision.optionLabel}. ${firstDecision.optionEffect}`
          : language === "en"
            ? "The first decision will shape the experience."
            : "İlk karar deneyimin yönünü belirleyecek.",
      },
      {
        title: language === "en" ? "Strength Signal" : "Güçlü Sinyal",
        visualDirection:
          language === "en"
            ? `Show the child using ${strongestTraitLabel.toLowerCase()} as a visible mission strength.`
            : `Çocuğun ${strongestTraitLabel.toLowerCase()} yönünü görev içinde görünür bir güç olarak kullandığı anı göster.`,
        narration:
          language === "en"
            ? `${strongestTraitLabel} became one of the strongest signals in this simulation.`
            : `${strongestTraitLabel}, bu simülasyondaki en güçlü sinyallerden biri oldu.`,
      },
      {
        title: language === "en" ? "Final Mission Reflection" : "Final Görev Yansıması",
        visualDirection:
          language === "en"
            ? "Show a calm closing scene with a report card, mission dashboard, and confident expression."
            : "Rapor kartı, görev paneli ve özgüvenli ifade içeren sakin bir kapanış sahnesi göster.",
        narration: finalDecision
          ? `${finalDecision.decisionTitle}: ${finalDecision.optionLabel}. ${finalDecision.optionEffect}`
          : language === "en"
            ? "The final report is ready for review."
            : "Final rapor incelemeye hazır.",
      },
    ],
    productionNote:
      language === "en"
        ? "Later, this blueprint can be converted into Storyverse-style scenes, visuals, voice-over, and a short recap video."
        : "İleride bu plan Storyverse benzeri sahnelere, görsellere, seslendirmeye ve kısa özet videoya dönüştürülebilir.",
  };
}


export function getCareerSimulationOutputPackage(
  language: "tr" | "en"
): {
  title: string;
  description: string;
  items: Array<{
    title: string;
    description: string;
    status: "ready" | "planned";
  }>;
} {
  return language === "en"
    ? {
        title: "Simulation Output Package",
        description:
          "This package shows what the child can receive after completing the interactive profession simulation.",
        items: [
          {
            title: "Decision Profile",
            description: "Local trait signals based on selected mission decisions.",
            status: "ready",
          },
          {
            title: "Experience Report",
            description: "A structured report with mission summary, decision highlights, and strength signals.",
            status: "ready",
          },
          {
            title: "Markdown Report File",
            description: "Copyable and downloadable report output for pilot usage.",
            status: "ready",
          },
          {
            title: "Cinematic Recap Blueprint",
            description: "A four-scene recap plan that can later feed the Storyverse production engine.",
            status: "ready",
          },
          {
            title: "AI-enhanced Narrative Report",
            description: "Future step using OpenAI to turn local signals into a richer child-friendly narrative.",
            status: "planned",
          },
          {
            title: "Short Cinematic Recap Video",
            description: "Future step using the existing visual, voice, and export pipeline.",
            status: "planned",
          },
        ],
      }
    : {
        title: "Simülasyon Çıktı Paketi",
        description:
          "Bu paket, interaktif meslek simülasyonu tamamlandıktan sonra çocuğa sunulabilecek çıktıları gösterir.",
        items: [
          {
            title: "Karar Profili",
            description: "Seçilen görev kararlarına göre oluşan yerel trait sinyalleri.",
            status: "ready",
          },
          {
            title: "Deneyim Raporu",
            description: "Görev özeti, karar özetleri ve güçlü sinyallerden oluşan yapılandırılmış rapor.",
            status: "ready",
          },
          {
            title: "Markdown Rapor Dosyası",
            description: "Pilot kullanım için kopyalanabilir ve indirilebilir rapor çıktısı.",
            status: "ready",
          },
          {
            title: "Sinematik Özet Planı",
            description: "İleride Storyverse üretim motoruna bağlanabilecek dört sahnelik özet planı.",
            status: "ready",
          },
          {
            title: "AI Destekli Anlatı Raporu",
            description: "Yerel sinyalleri daha zengin çocuk dostu anlatıya dönüştürecek gelecek adım.",
            status: "planned",
          },
          {
            title: "Kısa Sinematik Özet Videosu",
            description: "Mevcut görsel, ses ve export pipeline ile üretilecek gelecek adım.",
            status: "planned",
          },
        ],
      };
}


export function getCareerPilotQaChecklist(language: "tr" | "en"): {
  title: string;
  description: string;
  readyItems: string[];
  backlogItems: string[];
  acceptanceCriteria: string[];
} {
  return language === "en"
    ? {
        title: "Career Lab Pilot QA Checklist",
        description:
          "Use this checklist before considering the Career Lab shell ready for internal demo or next-stage AI enhancement.",
        readyItems: [
          "Profession selection works across all 5 pilot professions.",
          "Guided mission decisions are visible and selectable.",
          "Decision profile and trait signals update locally.",
          "Mission completion state appears after all decisions are selected.",
          "Experience report, markdown export, and output package summary are available.",
          "Turkish and English UI copy are supported.",
        ],
        backlogItems: [
          "AI-enhanced narrative report generation.",
          "Longer decision chains and adaptive scenario continuation.",
          "Supabase save/load for Career Lab sessions.",
          "Storyverse-style cinematic recap video generation.",
          "Parent/teacher-facing report view.",
        ],
        acceptanceCriteria: [
          "Build passes without TypeScript errors.",
          "A user can select each profession and complete all decisions.",
          "Restart mission resets decisions without breaking the selected profession.",
          "Downloaded markdown report contains the selected mission summary and decision highlights.",
        ],
      }
    : {
        title: "Career Lab Pilot QA Kontrol Listesi",
        description:
          "Career Lab iskeletini iç demo veya sonraki AI geliştirme aşamasına hazır kabul etmeden önce bu listeyi kullan.",
        readyItems: [
          "5 pilot mesleğin tamamında meslek seçimi çalışıyor.",
          "Yönlendirmeli görev kararları görünür ve seçilebilir durumda.",
          "Karar profili ve trait sinyalleri lokal olarak güncelleniyor.",
          "Tüm kararlar seçildiğinde görev tamamlandı durumu görünüyor.",
          "Deneyim raporu, markdown export ve çıktı paketi özeti mevcut.",
          "Türkçe ve İngilizce UI metinleri destekleniyor.",
        ],
        backlogItems: [
          "AI destekli anlatı raporu üretimi.",
          "Daha uzun karar zincirleri ve adaptif senaryo devamı.",
          "Career Lab oturumları için Supabase save/load.",
          "Storyverse tarzı sinematik özet video üretimi.",
          "Ebeveyn/öğretmen odaklı rapor görünümü.",
        ],
        acceptanceCriteria: [
          "Build TypeScript hatası olmadan geçmeli.",
          "Kullanıcı her mesleği seçip tüm kararları tamamlayabilmeli.",
          "Görevi sıfırla butonu seçili mesleği bozmadan kararları temizlemeli.",
          "İndirilen markdown raporu seçilen görev özetini ve karar özetlerini içermeli.",
        ],
      };
}


export function formatCareerSessionSnapshotJson(params: {
  professionKey: CareerProfessionKey;
  profession: ReturnType<typeof getCareerProfession>;
  mission: CareerMissionTemplate;
  profile: CareerTraitProfile;
  answers: Record<string, string>;
  language: "tr" | "en";
}): string {
  const { professionKey, profession, mission, profile, answers, language } = params;

  const answeredDecisions = mission.decisionPoints.map((decision) => {
    const selectedOptionId = answers[decision.id];
    const selectedOption = decision.options.find((option) => option.id === selectedOptionId);

    return {
      decisionId: decision.id,
      decisionType: decision.type,
      decisionTitle: decision.title[language] ?? decision.title.tr,
      selectedOptionId: selectedOption?.id ?? null,
      selectedOptionLabel: selectedOption
        ? selectedOption.label[language] ?? selectedOption.label.tr
        : null,
      selectedOptionEffect: selectedOption
        ? selectedOption.effect[language] ?? selectedOption.effect.tr
        : null,
      traitImpact: selectedOption?.traitImpact ?? null,
    };
  });

  return JSON.stringify(
    {
      product: "VELTO Career Lab",
      version: "pilot-local-v1",
      language,
      professionKey,
      professionTitle: profession.title[language] ?? profession.title.tr,
      mission: {
        title: mission.title[language] ?? mission.title.tr,
        briefing: mission.briefing[language] ?? mission.briefing.tr,
        objective: mission.objective[language] ?? mission.objective.tr,
      },
      progress: {
        answered: Object.keys(answers).length,
        total: mission.decisionPoints.length,
        completed: Object.keys(answers).length >= mission.decisionPoints.length,
      },
      traitProfile: profile,
      decisions: answeredDecisions,
      generatedAt: new Date().toISOString(),
      note:
        language === "en"
          ? "This snapshot is not a career test or psychological assessment."
          : "Bu çıktı bir kariyer testi veya psikolojik değerlendirme değildir.",
    },
    null,
    2
  );
}


export function formatCareerNarrativeReportPrompt(params: {
  profession: ReturnType<typeof getCareerProfession>;
  mission: CareerMissionTemplate;
  report: ReturnType<typeof getCareerFinalReport>;
  recapBlueprint: ReturnType<typeof getCareerCinematicRecapBlueprint>;
  snapshotJson: string;
  language: "tr" | "en";
}): string {
  const { profession, mission, report, recapBlueprint, snapshotJson, language } = params;
  const professionTitle = profession.title[language] ?? profession.title.tr;
  const missionTitle = mission.title[language] ?? mission.title.tr;

  if (language === "en") {
    return [
      "You are VELTO AI Career Lab's child-safe narrative report assistant.",
      "",
      "Goal:",
      "Turn the local simulation signals below into a warm, encouraging, child-friendly experience report.",
      "",
      "Strict rules:",
      "- Do not present this as a career test.",
      "- Do not make psychological or diagnostic claims.",
      "- Do not say the child should become this profession.",
      "- Use supportive, exploratory language.",
      "- Keep the output suitable for ages 9-15.",
      "- Mention that the report reflects choices made inside a simulation.",
      "",
      `Profession: ${professionTitle}`,
      `Mission: ${missionTitle}`,
      "",
      "Existing structured report:",
      JSON.stringify(report, null, 2),
      "",
      "Cinematic recap blueprint:",
      JSON.stringify(recapBlueprint, null, 2),
      "",
      "Session snapshot:",
      snapshotJson,
      "",
      "Required output sections:",
      "1. Short mission story",
      "2. What your choices showed inside the simulation",
      "3. Strength signals",
      "4. One thing to try next time",
      "5. Parent/mentor note",
    ].join("\n");
  }

  return [
    "Sen VELTO AI Career Lab'in çocuk güvenli anlatı raporu asistanısın.",
    "",
    "Amaç:",
    "Aşağıdaki yerel simülasyon sinyallerini sıcak, teşvik edici ve çocuk dostu bir deneyim raporuna dönüştür.",
    "",
    "Kesin kurallar:",
    "- Bunu kariyer testi gibi sunma.",
    "- Psikolojik veya tanısal iddialarda bulunma.",
    "- Çocuğun bu mesleği seçmesi gerektiğini söyleme.",
    "- Destekleyici ve keşif odaklı bir dil kullan.",
    "- Çıktıyı 9-15 yaş aralığına uygun tut.",
    "- Raporun yalnızca simülasyon içindeki seçimleri yansıttığını belirt.",
    "",
    `Meslek: ${professionTitle}`,
    `Görev: ${missionTitle}`,
    "",
    "Mevcut yapılandırılmış rapor:",
    JSON.stringify(report, null, 2),
    "",
    "Sinematik özet planı:",
    JSON.stringify(recapBlueprint, null, 2),
    "",
    "Oturum snapshot:",
    snapshotJson,
    "",
    "Zorunlu çıktı bölümleri:",
    "1. Kısa görev hikâyesi",
    "2. Simülasyon içinde seçimlerin ne gösterdi",
    "3. Güçlü sinyaller",
    "4. Bir sonraki denemede keşfedilecek şey",
    "5. Ebeveyn/mentor notu",
  ].join("\n");
}


export function formatCareerNarrativeReportPayload(params: {
  professionKey: CareerProfessionKey;
  profession: ReturnType<typeof getCareerProfession>;
  mission: CareerMissionTemplate;
  profile: CareerTraitProfile;
  answers: Record<string, string>;
  report: ReturnType<typeof getCareerFinalReport>;
  recapBlueprint: ReturnType<typeof getCareerCinematicRecapBlueprint>;
  snapshotJson: string;
  prompt: string;
  language: "tr" | "en";
}): string {
  const {
    professionKey,
    profession,
    mission,
    profile,
    answers,
    report,
    recapBlueprint,
    snapshotJson,
    prompt,
    language,
  } = params;

  return JSON.stringify(
    {
      endpointDraft: "/api/career-narrative-report",
      method: "POST",
      product: "VELTO Career Lab",
      version: "ai-narrative-report-payload-v1",
      language,
      professionKey,
      professionTitle: profession.title[language] ?? profession.title.tr,
      missionTitle: mission.title[language] ?? mission.title.tr,
      safetyMode: {
        childSafe: true,
        notCareerTest: true,
        noPsychologicalAssessment: true,
        noDeterministicCareerAdvice: true,
      },
      modelIntent: {
        provider: "OpenAI",
        purpose: "Generate child-friendly narrative report from structured local simulation signals",
        costStatus: "Not executed in current build",
      },
      prompt,
      structuredInputs: {
        traitProfile: profile,
        answers,
        report,
        recapBlueprint,
        snapshot: JSON.parse(snapshotJson),
      },
    },
    null,
    2
  );
}

export function getCareerAiPayloadReadinessNotes(language: "tr" | "en"): {
  title: string;
  items: string[];
} {
  return language === "en"
    ? {
        title: "AI payload readiness",
        items: [
          "The payload is prepared locally and does not call OpenAI yet.",
          "It can later become the request body for /api/career-narrative-report.",
          "The safety rules explicitly prevent career-test or psychological-assessment positioning.",
          "The next backend step should be an isolated API route, not changes to Storyverse or Creator Lab pipelines.",
        ],
      }
    : {
        title: "AI payload hazırlığı",
        items: [
          "Payload lokal olarak hazırlanır ve henüz OpenAI çağrısı yapmaz.",
          "İleride /api/career-narrative-report endpoint'i için request body olabilir.",
          "Güvenlik kuralları kariyer testi veya psikolojik değerlendirme konumlandırmasını açıkça engeller.",
          "Sonraki backend adımı Storyverse veya Creator Lab pipeline'ına değil, izole bir API route'a yapılmalıdır.",
        ],
      };
}


export function getCareerAiNarrativeQaChecklist(language: "tr" | "en"): {
  title: string;
  description: string;
  items: Array<{
    label: string;
    detail: string;
  }>;
} {
  return language === "en"
    ? {
        title: "AI Narrative QA Checklist",
        description:
          "Use this checklist before considering the AI narrative layer ready for pilot demo.",
        items: [
          { label: "AI response", detail: "Generate AI Narrative Report returns a readable Markdown report." },
          { label: "Safety language", detail: "The report does not position the output as a career test or psychological assessment." },
          { label: "Language consistency", detail: "Turkish UI produces Turkish report; English UI produces English report." },
          { label: "Copy / download", detail: "Copy AI report and Download AI report work after generation." },
          { label: "Regeneration guard", detail: "Regenerate asks for confirmation because it may create additional OpenAI cost." },
          { label: "Isolation", detail: "Storyverse, Creator Lab, Supabase, Railway, and export-service remain untouched." },
        ],
      }
    : {
        title: "AI Narrative QA Kontrol Listesi",
        description:
          "AI anlatı katmanını pilot demo için hazır kabul etmeden önce bu listeyi kullan.",
        items: [
          { label: "AI response", detail: "AI Anlatı Raporu Üret aksiyonu okunabilir Markdown rapor döndürür." },
          { label: "Güvenlik dili", detail: "Rapor, çıktıyı kariyer testi veya psikolojik değerlendirme gibi konumlandırmaz." },
          { label: "Dil tutarlılığı", detail: "Türkçe UI Türkçe rapor; İngilizce UI İngilizce rapor üretir." },
          { label: "Kopyalama / indirme", detail: "AI raporu kopyala ve AI raporu indir aksiyonları üretim sonrası çalışır." },
          { label: "Yeniden üretim koruması", detail: "Yeniden üretim ek OpenAI maliyeti oluşturabileceği için onay ister." },
          { label: "İzolasyon", detail: "Storyverse, Creator Lab, Supabase, Railway ve export-service etkilenmez." },
        ],
      };
}


export function getCareerPersistenceQaChecklist(language: "tr" | "en"): {
  title: string;
  description: string;
  items: Array<{
    label: string;
    detail: string;
  }>;
} {
  return language === "en"
    ? {
        title: "Career Lab Persistence QA",
        description:
          "Use this checklist before considering Save / Load / Delete ready for pilot usage.",
        items: [
          {
            label: "Save",
            detail: "Complete a mission, save the session, and confirm a session ID appears.",
          },
          {
            label: "Update",
            detail: "Change a decision or regenerate AI report, then save again and confirm the same session updates.",
          },
          {
            label: "List",
            detail: "Refresh saved sessions and confirm the latest session appears at the top.",
          },
          {
            label: "Load",
            detail: "Load a saved session and confirm profession, decisions, and AI narrative report return.",
          },
          {
            label: "Delete",
            detail: "Delete a saved session and confirm it disappears from the list.",
          },
          {
            label: "Security",
            detail: "Confirm a signed-out user cannot save or list sessions.",
          },
        ],
      }
    : {
        title: "Career Lab Persistence QA",
        description:
          "Save / Load / Delete katmanını pilot kullanıma hazır kabul etmeden önce bu listeyi kullan.",
        items: [
          {
            label: "Save",
            detail: "Görevi tamamla, oturumu kaydet ve session ID göründüğünü doğrula.",
          },
          {
            label: "Update",
            detail: "Bir kararı değiştir veya AI raporu yeniden üret, tekrar kaydet ve aynı session’ın güncellendiğini doğrula.",
          },
          {
            label: "List",
            detail: "Kayıtlı oturumları yenile ve son oturumun en üstte göründüğünü doğrula.",
          },
          {
            label: "Load",
            detail: "Kayıtlı oturumu yükle; meslek, kararlar ve AI anlatı raporunun geri geldiğini doğrula.",
          },
          {
            label: "Delete",
            detail: "Kayıtlı oturumu sil ve listeden kaybolduğunu doğrula.",
          },
          {
            label: "Security",
            detail: "Giriş yapılmadan kayıt veya listeleme yapılamadığını doğrula.",
          },
        ],
      };
}
