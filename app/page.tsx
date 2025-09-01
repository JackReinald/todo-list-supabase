"use client";

import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MdEdit, MdCheck, MdDelete } from "react-icons/md";

export default function App() {
  // App features
  type Todo = {
    id: number;
    title: string;
    is_complete: boolean;
    created_at: Date;
    user_id: string;
  };

  const [toDos, setToDos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newTodo, setNewTodo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [taskToEditId, setTaskToEditId] = useState<number | null>(null);
  const [titleToEdit, setTitleToEdit] = useState<string>("");

  const router = useRouter();

  const fetchToDos = async (userId: string) => {
    try {
      const supabase = createClient();
      setLoading(true);
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", userId); // Filters the data through userId
      if (error) throw error;

      setToDos(data);
    } catch (err) {
      console.error("Error fetching todos:", err);
      setError("Error al cargar las tareas.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.refresh(); // Refreshes the app, forcing the state updating 
      router.push("/"); // Redirects the user to the login page after signing out

    } catch (err) {
      console.error("Error signing out:", err);
      setError("Error al cerrar sesión.");
    }
  };

  // Gets the session and load the user's own activites
  useEffect(() => {
    const supabase = createClient();
    const fetchUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setUser(data.session.user);
        fetchToDos(data.session.user.id);
      } else {
        router.push("/")
        setError("Log in to see your tasks. ");
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
        <p className="text-center text-gray-500 dark:text-gray-400">
          Cargando tareas...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
        <p className="text-center text-gray-500 dark:text-gray-400">
          Por favor, inicia sesión para gestionar tus tareas.
        </p>
      </div>
    );
  }

  // CRUD events
  const handleAddTodo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTodo.trim() || !user) return; // Makes sure there is an authenticated user prior to send

    try {
      const n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_PRODUCTION_URL;

      if (!n8nWebhookUrl) {
        throw new Error("N8N webhook URL is not defined.");
      }

      const response = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTodo,
          user_email: user.email,
        }),
      });

      if (!response.ok) {
        throw new Error("Error en la llamada al webhook de n8n");
      }

      await fetchToDos(user.id); // Renders the UI each time a new task is added

      setNewTodo("");
    } catch (err) {
      if (err instanceof Error) {
        console.error("Error adding task via webhook: ", err.message);
      } else {
        console.error("Error adding task via webhook: ", err);
      }
      setError("Error al agregar la tarea.");
    }
  };

  const handleToggleComplete = async (todo: Todo) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("todos")
        .update({ is_complete: !todo.is_complete })
        .eq("id", todo.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setToDos(
        toDos.map((t) =>
          t.id === todo.id ? { ...t, is_complete: !t.is_complete } : t
        ) // Updates the activity state
      );
    } catch (err) {
      if (err instanceof Error) {
        console.error("Error updating title: ", err.message);
      } else {
        console.error("Error updating title: ", err);
      }
      setError("Error while updating the task.");
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("todos").delete().eq("id", id);
      if (error) throw error;
      setToDos(toDos.filter((t) => t.id !== id));
    } catch (err) {
      if (err instanceof Error) {
        console.error("Error updating title: ", err.message);
      } else {
        console.error("Error updating title: ", err);
      }
      setError("Error al eliminar la tarea.");
    }
  };

  const handleUpdateTodo = async (id: number, newTitle: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("todos")
        .update({ title: newTitle })
        .eq("id", id);
      if (error) throw error;

      setToDos(toDos.map((t) => (t.id === id ? { ...t, title: newTitle } : t)));
    } catch (err) {
      if (err instanceof Error) {
        console.error("Error updating title: ", err.message);
      } else {
        console.error("Error updating title: ", err);
      }
      setError("Error while trying to update the task.");
    }
  };

  const handleEditClick = (todo: Todo) => {
    setTaskToEditId(todo.id);
    setTitleToEdit(todo.title);
  };

  const handleSaveEdit = (id: number) => {
    if (titleToEdit.trim()) {
      handleUpdateTodo(id, titleToEdit);

      // Cleans the state
      setTaskToEditId(null);
      setTitleToEdit("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100">
            To-Do List
          </h1>
          <button
            onClick={handleSignOut}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        <form onSubmit={handleAddTodo} className="flex mb-6">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            className="flex-grow p-3 rounded-l-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            placeholder="Add a new task..."
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-r-lg transition-colors"
          >
            Add it!
          </button>
        </form>

        {loading ? (
          <p className="text-center text-gray-500 dark:text-gray-400">
            Cargando tareas...
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto pr-2">
            <ul className="space-y-4">
              {toDos.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400">
                  ¡No hay tareas!
                </p>
              ) : (
                toDos.map((toDo) => (
                  <li
                    key={toDo.id}
                    className="flex items-center bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm"
                  >
                    {taskToEditId === toDo.id ? (
                      // Renders the input field and check button
                      <div className="flex-grow flex items-center">
                        <textarea
                          value={titleToEdit}
                          onChange={(e) => setTitleToEdit(e.target.value)}
                          className="flex-grow p-2 rounded border border-gray-200 resize-none dark:bg-gray-800 dark:text-gray-100" // Añadida la clase resize-none para evitar que el usuario lo redimensione
                          style={{ height: "auto", minHeight: "40px" }} // Min. height
                          rows={3}
                        />
                        <button
                          onClick={() => handleSaveEdit(toDo.id)}
                          className="ml-2 text-green-500 hover:text-green-700 transition-colors"
                        >
                          <MdCheck className="w-6 h-6" />
                        </button>
                      </div>
                    ) : (
                      // Renders the title of the task previous to any click
                      <>
                        <span
                          onClick={() => handleToggleComplete(toDo)}
                          className={`flex-grow cursor-pointer text-gray-800 dark:text-gray-200 transition-colors ${
                            toDo.is_complete
                              ? "line-through text-gray-400 dark:text-gray-500"
                              : ""
                          }`}
                        >
                          {toDo.title}
                        </span>
                        {toDo.is_complete ? (
                          <span className=" text-green-500"> DONE </span>
                        ) : (
                          <span className="text-orange-400"> NOT DONE </span>
                        )}

                        <button
                          onClick={() => handleEditClick(toDo)}
                          className="ml-4 text-blue-500 hover:text-blue-700 transition-colors"
                        >
                          <MdEdit className="w-6 h-6" />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDeleteTodo(toDo.id)}
                      className="ml-4 text-red-500 hover:text-red-700 transition-colors"
                      aria-label={`Eliminar tarea: ${toDo.title}`}
                    >
                      <MdDelete className="w-6 h-6" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
