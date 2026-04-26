"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Project = {
  id: string;
  title: string;
  language: string;
  story_premise: string;
  characters: any[];
  scenes: any[];
};

export default function EpisodePage() {
  const params = useParams();
  const projectId = params?.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProject = async () => {
      try {
        const token = localStorage.getItem("access_token");

        const res = await fetch(`/api/load-project/${projectId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (data.success) {
          setProject(data.project);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  if (loading) {
    return <div className="p-10 text-white">Yükleniyor...</div>;
  }

  if (!project) {
    return <div className="p-10 text-white">Proje bulunamadı</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-5xl mx-auto space-y-10">
        
        {/* HEADER */}
        <div>
          <h1 className="text-4xl font-bold">{project.title}</h1>
          <p className="text-gray-400 mt-2">{project.story_premise}</p>
        </div>

        {/* CHARACTERS */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Karakterler</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {project.characters?.map((char, i) => (
              <div key={i} className="p-4 bg-white/5 rounded-xl">
                <p className="font-semibold">{char.name}</p>
                <p className="text-sm text-gray-400">{char.personality}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SCENES */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Sahneler</h2>
          <div className="space-y-6">
            {project.scenes?.map((scene, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-2">
                  Sahne {i + 1}
                </p>

                {scene.imageUrl && (
                  <img
                    src={scene.imageUrl}
                    className="rounded-lg mb-3"
                  />
                )}

                <p className="text-gray-200">{scene.narration}</p>

                {scene.dialogue && (
                  <p className="text-sm text-purple-300 mt-2">
                    {scene.dialogue}
                  </p>
                )}

                {scene.videoUrl && (
                  <video
                    src={scene.videoUrl}
                    controls
                    className="mt-3 rounded-lg"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}