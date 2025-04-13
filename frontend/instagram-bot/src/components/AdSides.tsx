import { useEffect } from "react";

const AdSides = () => {
  useEffect(() => {
    if ((window as any).adsbygoogle) {
      (window as any).adsbygoogle.push({});
    }
  }, []);

  return (
    <>
      {/* Left Side Ad */}
      <div className="fixed top-0 left-0 h-full w-[120px] hidden lg:flex items-center justify-center z-40">
        <div className="w-[120px] h-[600px] bg-white shadow-md rounded-md flex items-center justify-center">
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "120px", height: "600px" }}
            data-ad-client="ca-pub-3716879881504428"
            data-ad-slot="8782189753"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>

      {/* Right Side Ad */}
      <div className="fixed top-0 right-0 h-full w-[120px] hidden lg:flex items-center justify-center z-40">
        <div className="w-[120px] h-[600px] bg-white shadow-md rounded-md flex items-center justify-center">
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "120px", height: "600px" }}
            data-ad-client="ca-pub-3716879881504428"
            data-ad-slot="6319677946"
            data-ad-format="auto"
            data-full-width-responsive="true"

          />
        </div>
      </div>
    </>
  );
};

export default AdSides;
